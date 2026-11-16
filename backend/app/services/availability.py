"""Availability rules. The same function is used for the public check and inside booking approval."""
import math
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (AccountStatus, Booking, BookingStatus, Resource, ResourceAvailability, ResourceStatus,
                        VerificationStatus)

BLOCKING = (BookingStatus.confirmed, BookingStatus.active)


def merged_windows(windows: list[ResourceAvailability]) -> list[tuple[datetime, datetime]]:
    spans = sorted((w.start_at, w.end_at) for w in windows)
    out: list[list[datetime]] = []
    for s, e in spans:
        if out and s <= out[-1][1]:
            out[-1][1] = max(out[-1][1], e)
        else:
            out.append([s, e])
    return [(s, e) for s, e in out]


def blocking_bookings(db: Session, resource_id: int, start: datetime, end: datetime, exclude_id: int | None = None):
    q = select(Booking).where(Booking.resource_id == resource_id, Booking.status.in_(BLOCKING),
                              Booking.start_at < end, Booking.end_at > start)
    if exclude_id:
        q = q.where(Booking.id != exclude_id)
    return list(db.scalars(q))


def check_availability(db: Session, resource: Resource, start: datetime, end: datetime,
                       exclude_booking_id: int | None = None) -> list[str]:
    """Return a list of human-readable reasons why the period is NOT bookable (empty = bookable)."""
    reasons: list[str] = []
    now = datetime.now(timezone.utc)
    if end <= start:
        return ["The end time must be after the start time."]
    if resource.status != ResourceStatus.active:
        reasons.append("This resource is not currently offered for sharing.")
    owner = resource.owner
    if owner.account_status != AccountStatus.active or owner.verification_status != VerificationStatus.approved:
        reasons.append("The owner's account is not eligible to share resources right now.")
    if start < now - timedelta(minutes=5):
        reasons.append("The start time is in the past.")
    hours = (end - start).total_seconds() / 3600
    if hours < resource.min_hours:
        reasons.append(f"Minimum booking length is {resource.min_hours} hours.")
    if hours > resource.max_days * 24:
        reasons.append(f"Maximum booking length is {resource.max_days} days.")
    windows = merged_windows(resource.availability)
    if not any(ws <= start and end <= we for ws, we in windows):
        reasons.append("The owner has not offered this resource for the whole requested period.")
    if blocking_bookings(db, resource.id, start, end, exclude_booking_id):
        reasons.append("Another booking already covers part of this period.")
    return reasons


def rental_amount(resource: Resource, start: datetime, end: datetime) -> Decimal:
    days = max(1, math.ceil((end - start).total_seconds() / 86400))
    return Decimal(resource.price_per_day) * days
