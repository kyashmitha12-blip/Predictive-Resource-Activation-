"""Booking lifecycle. Every state change is validated here, on the server."""
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import (Booking, BookingStatus, BookingStatusHistory, ConditionReport, ConditionReportKind,
                        Report, ReportKind, ReportStatus, Resource, User)
from app.services.availability import check_availability, rental_amount
from app.services.core import audit, notify, notify_admins

ON_TIME_GRACE = timedelta(hours=1)
LATE_CANCEL_WINDOW = timedelta(hours=24)


def _move(db: Session, b: Booking, to: BookingStatus, actor: User | None, note: str = "") -> None:
    db.add(BookingStatusHistory(booking_id=b.id, from_status=b.status.value if b.status else None,
                                to_status=to.value, actor_id=actor.id if actor else None, note=note))
    b.status = to


def _require(cond: bool, msg: str, code: int = 409) -> None:
    if not cond:
        raise HTTPException(code, msg)


def get_for_party(db: Session, booking_id: int, user: User) -> Booking:
    b = db.get(Booking, booking_id)
    if not b or (user.id not in (b.borrower_id, b.owner_id) and not user.is_admin):
        raise HTTPException(404, "Booking not found.")
    return b


def create_booking(db: Session, borrower: User, resource_id: int, start: datetime, end: datetime, note: str) -> Booking:
    resource = db.get(Resource, resource_id)
    if not resource:
        raise HTTPException(404, "Resource not found.")
    if resource.owner_id == borrower.id:
        raise HTTPException(409, "You cannot book your own resource.")
    reasons = check_availability(db, resource, start, end)
    if reasons:
        raise HTTPException(409, " ".join(reasons))
    dup = db.scalar(select(Booking.id).where(
        Booking.resource_id == resource.id, Booking.borrower_id == borrower.id,
        Booking.status == BookingStatus.requested, Booking.start_at < end, Booking.end_at > start))
    if dup:
        raise HTTPException(409, "You already have a pending request for an overlapping period.")
    b = Booking(resource_id=resource.id, borrower_id=borrower.id, owner_id=resource.owner_id, start_at=start,
                end_at=end, note=note, status=BookingStatus.requested,
                rental_amount=rental_amount(resource, start, end), deposit_amount=resource.deposit,
                payment_status="demo_pending" if rental_amount(resource, start, end) > 0 else "not_required",
                deposit_status="none")
    db.add(b)
    db.flush()
    db.add(BookingStatusHistory(booking_id=b.id, from_status=None, to_status="requested", actor_id=borrower.id, note=note))
    notify(db, resource.owner_id, "booking_request", f"New booking request for {resource.name}",
           f"{borrower.name} would like to borrow it from {start:%d %b %H:%M} to {end:%d %b %H:%M}.",
           f"/app/requests")
    db.commit()
    return b


def approve(db: Session, b: Booking, owner: User) -> Booking:
    _require(b.owner_id == owner.id, "Only the owner can approve this request.", 403)
    _require(b.status == BookingStatus.requested, f"A {b.status.value} booking cannot be approved.")
    # Lock the resource row so two approvals for the same resource are processed one at a time.
    resource = db.scalar(select(Resource).where(Resource.id == b.resource_id).with_for_update())
    reasons = check_availability(db, resource, b.start_at, b.end_at, exclude_booking_id=b.id)
    if reasons:
        raise HTTPException(409, " ".join(reasons))
    try:
        _move(db, b, BookingStatus.confirmed, owner)
        if b.rental_amount > 0:
            b.payment_status = "demo_paid"  # DEMO: no real money moves
        if b.deposit_amount > 0:
            b.deposit_status = "demo_held"
        db.flush()  # the exclusion constraint is enforced here
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Another booking was confirmed for this period a moment ago.")
    notify(db, b.borrower_id, "booking_confirmed", "Your booking was approved",
           f"{resource.name} is confirmed. Arrange the handover with the owner.", f"/app/bookings/{b.id}")
    audit(db, owner, "booking.approve", "booking", b.id)
    db.commit()
    return b


def reject(db: Session, b: Booking, owner: User, reason: str) -> Booking:
    _require(b.owner_id == owner.id, "Only the owner can reject this request.", 403)
    _require(b.status == BookingStatus.requested, f"A {b.status.value} booking cannot be rejected.")
    _move(db, b, BookingStatus.rejected, owner, reason)
    if b.payment_status == "demo_paid":
        b.payment_status = "demo_refunded"
    notify(db, b.borrower_id, "booking_rejected", "Your booking request was declined",
           reason or "The owner could not lend it for this period.", f"/app/bookings/{b.id}")
    db.commit()
    return b


def cancel(db: Session, b: Booking, user: User, reason: str) -> Booking:
    _require(user.id in (b.borrower_id, b.owner_id), "You are not part of this booking.", 403)
    _require(b.status in (BookingStatus.requested, BookingStatus.confirmed),
             "Only requested or confirmed bookings can be cancelled. Contact an administrator for active ones.")
    now = datetime.now(timezone.utc)
    if b.status == BookingStatus.confirmed and b.start_at - now < LATE_CANCEL_WINDOW:
        b.late_cancellation = True  # counted in reliability indicators
    _move(db, b, BookingStatus.cancelled, user, reason)
    if b.payment_status == "demo_paid":
        b.payment_status = "demo_refunded"
    if b.deposit_status == "demo_held":
        b.deposit_status = "demo_released"
    other = b.owner_id if user.id == b.borrower_id else b.borrower_id
    notify(db, other, "booking_cancelled", "A booking was cancelled", reason or f"{user.name} cancelled the booking.",
           f"/app/bookings/{b.id}")
    db.commit()
    return b


def handover(db: Session, b: Booking, owner: User, notes: str = "", photo_keys: list[str] | None = None) -> Booking:
    _require(b.owner_id == owner.id, "Only the owner can confirm the handover.", 403)
    _require(b.status == BookingStatus.confirmed, "Only a confirmed booking can be handed over.")
    _require(datetime.now(timezone.utc) < b.end_at, "This booking period has already ended.")
    _move(db, b, BookingStatus.active, owner, "Handed over")
    db.add(ConditionReport(booking_id=b.id, kind=ConditionReportKind.handover, reporter_id=owner.id,
                           condition="as_expected", notes=notes, photo_keys=photo_keys or []))
    notify(db, b.borrower_id, "booking_active", "Handover confirmed",
           "The rental is now active. Please return it on time.", f"/app/bookings/{b.id}")
    db.commit()
    return b


def report_return(db: Session, b: Booking, borrower: User, condition: str, notes: str, photo_keys: list[str]) -> Booking:
    _require(b.borrower_id == borrower.id, "Only the borrower can report the return.", 403)
    _require(b.status == BookingStatus.active, "Only an active rental can be returned.")
    now = datetime.now(timezone.utc)
    b.returned_at = now
    b.returned_on_time = now <= b.end_at + ON_TIME_GRACE
    _move(db, b, BookingStatus.returned, borrower, "Returned by borrower")
    db.add(ConditionReport(booking_id=b.id, kind=ConditionReportKind.returned, reporter_id=borrower.id,
                           condition=condition, notes=notes, photo_keys=photo_keys))
    notify(db, b.owner_id, "return_reported", "Your resource was returned",
           "Please check it and confirm the return with its condition.", f"/app/bookings/{b.id}")
    db.commit()
    return b


def confirm_return(db: Session, b: Booking, owner: User, condition: str, notes: str, photo_keys: list[str]) -> Booking:
    _require(b.owner_id == owner.id, "Only the owner can confirm the return.", 403)
    _require(b.status == BookingStatus.returned, "The borrower has not reported a return yet.")
    db.add(ConditionReport(booking_id=b.id, kind=ConditionReportKind.returned, reporter_id=owner.id,
                           condition=condition, notes=notes, photo_keys=photo_keys))
    now = datetime.now(timezone.utc)
    resource = db.get(Resource, b.resource_id)
    if condition == "damaged":
        # Never deduct a deposit automatically: open a dispute for an administrator to review.
        _move(db, b, BookingStatus.disputed, owner, "Damage reported by owner")
        db.add(Report(reporter_id=owner.id, kind=ReportKind.damage, target_type="booking", target_id=b.id,
                      booking_id=b.id, description=notes or "Damage reported on return.", status=ReportStatus.open))
        notify_admins(db, "dispute_opened", "Damage dispute needs review", f"Booking #{b.id} ({resource.name})", "/admin/reports")
        notify(db, b.borrower_id, "dispute_opened", "The owner reported damage",
               "An administrator will review the case. Your deposit is not changed automatically.", f"/app/bookings/{b.id}")
    else:
        _move(db, b, BookingStatus.completed, owner, "Return confirmed")
        b.completed_at = now
        if b.deposit_status == "demo_held":
            b.deposit_status = "demo_released"
        _record_use(resource, b)
        notify(db, b.borrower_id, "booking_completed", "Return confirmed - please leave a review",
               "Your rental is complete and the deposit (demo) is released.", f"/app/bookings/{b.id}")
    db.commit()
    return b


def _record_use(resource: Resource, b: Booking) -> None:
    used_until = b.returned_at or b.end_at
    if resource.last_booked_at is None or used_until > resource.last_booked_at:
        resource.last_booked_at = used_until


def resolve_dispute(db: Session, b: Booking, admin: User, outcome: str, note: str) -> Booking:
    _require(b.status == BookingStatus.disputed, "This booking is not in dispute.")
    _require(outcome in ("release_deposit", "retain_deposit"), "Unknown outcome.", 422)
    b.deposit_status = "demo_released" if outcome == "release_deposit" else "demo_retained"
    _move(db, b, BookingStatus.completed, admin, f"Dispute resolved: {outcome}. {note}".strip())
    b.completed_at = datetime.now(timezone.utc)
    _record_use(db.get(Resource, b.resource_id), b)
    for uid in (b.owner_id, b.borrower_id):
        notify(db, uid, "dispute_resolved", "Dispute resolved", f"Outcome: {outcome.replace('_', ' ')}. {note}".strip(),
               f"/app/bookings/{b.id}")
    audit(db, admin, "dispute.resolve", "booking", b.id, outcome=outcome)
    db.commit()
    return b
