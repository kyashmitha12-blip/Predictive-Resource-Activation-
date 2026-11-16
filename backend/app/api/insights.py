"""Matching, forecasts for students, owner-side activation, and the student dashboard."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.api.serializers import activation_out, booking_out, resource_out
from app.database import get_db
from app.models import (ActivationRequest, ActivationStatus, Booking, BookingStatus, BookingStatusHistory, Notification,
                        Resource, ResourceStatus, Review, User)
from app.schemas.inputs import ActivationAcceptIn, ReasonIn
from app.security.deps import current_user, require_verified_student
from app.services import activation as act
from app.services import forecast_service
from app.services.matching import match
from app.services.reliability import user_stats

router = APIRouter(prefix="/api", tags=["insights"])


@router.get("/matching")
def matching(start: datetime, end: datetime, category: str | None = None, max_price_per_day: float | None = Query(None, ge=0),
             area: str | None = Query(None, max_length=100), keywords: str | None = Query(None, max_length=100),
             user: User = Depends(current_user), db: Session = Depends(get_db)):
    if start.tzinfo is None or end.tzinfo is None:
        raise HTTPException(422, "start/end need a timezone offset.")
    if end <= start:
        raise HTTPException(422, "The end time must be after the start time.")
    res = match(db, start, end, category, max_price_per_day, area, keywords, exclude_owner_id=user.id)
    res["matches"] = [{"score": m["score"], "reasons": m["reasons"], "components": m["components"], "estimated_cost": m["estimated_cost"],
                       "deposit": m["deposit"], "newly_activated": m["newly_activated"],
                       "resource": resource_out(m["resource"], m["owner_stats"])} for m in res["matches"]]
    res["method"] = "Weighted score computed on the server from price, condition, owner reliability, pickup area and keyword fit. Unavailable resources are excluded, never ranked."
    return res


@router.get("/forecast/latest")
def forecast_latest(_: User = Depends(current_user), db: Session = Depends(get_db)):
    s = forecast_service.summary(db)
    if not s:
        return {"available": False}
    return {"available": True, **s}


# ---- owner activation ---------------------------------------------------------------------------------
@router.get("/activation/mine")
def my_activation(status: str | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)):
    act.expire_stale(db)
    db.commit()
    stmt = select(ActivationRequest).where(ActivationRequest.owner_id == user.id).options(
        joinedload(ActivationRequest.resource).selectinload(Resource.images)).order_by(ActivationRequest.id.desc())
    if status:
        stmt = stmt.where(ActivationRequest.status.in_([s for s in ActivationStatus if s.value in status.split(",")]))
    return [activation_out(a) for a in db.scalars(stmt).unique()]


def _own(db: Session, aid: int, user: User) -> ActivationRequest:
    a = db.scalars(select(ActivationRequest).where(ActivationRequest.id == aid).options(
        joinedload(ActivationRequest.resource).selectinload(Resource.images))).unique().one_or_none()
    if not a or (a.owner_id != user.id and not user.is_admin):
        raise HTTPException(404, "Activation request not found.")
    return a


@router.get("/activation/{aid}")
def activation_detail(aid: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return activation_out(_own(db, aid, user))


@router.post("/activation/{aid}/accept")
def activation_accept(aid: int, body: ActivationAcceptIn, user: User = Depends(require_verified_student), db: Session = Depends(get_db)):
    act.accept(db, aid, user, body.available_from, body.available_until)
    return activation_out(_own(db, aid, user))


@router.post("/activation/{aid}/decline")
def activation_decline(aid: int, body: ReasonIn, user: User = Depends(require_verified_student), db: Session = Depends(get_db)):
    act.decline(db, aid, user, body.reason)
    return activation_out(_own(db, aid, user))


@router.post("/activation/{aid}/withdraw")
def activation_withdraw(aid: int, user: User = Depends(require_verified_student), db: Session = Depends(get_db)):
    act.withdraw(db, aid, user)
    return activation_out(_own(db, aid, user))


# ---- student dashboard ---------------------------------------------------------------------------------
@router.get("/dashboard/student")
def student_dashboard(user: User = Depends(current_user), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    opts = (joinedload(Booking.resource).selectinload(Resource.images), joinedload(Booking.borrower), joinedload(Booking.owner))
    mine = or_(Booking.borrower_id == user.id, Booking.owner_id == user.id)
    upcoming = db.scalars(select(Booking).where(mine, Booking.status.in_((BookingStatus.confirmed, BookingStatus.active)), Booking.end_at > now)
                          .options(*opts).order_by(Booking.start_at).limit(6)).unique()
    pending_in = db.scalar(select(func.count()).where(Booking.owner_id == user.id, Booking.status == BookingStatus.requested)) or 0
    pending_out = db.scalar(select(func.count()).where(Booking.borrower_id == user.id, Booking.status == BookingStatus.requested)) or 0
    awaiting_return = db.scalar(select(func.count()).where(Booking.owner_id == user.id, Booking.status == BookingStatus.returned)) or 0
    my_res = db.scalar(select(func.count()).where(Resource.owner_id == user.id, Resource.status.in_((ResourceStatus.active, ResourceStatus.inactive, ResourceStatus.maintenance)))) or 0
    act.expire_stale(db)
    pending_act = list(db.scalars(select(ActivationRequest).where(ActivationRequest.owner_id == user.id, ActivationRequest.status == ActivationStatus.pending)
                                  .options(joinedload(ActivationRequest.resource).selectinload(Resource.images)).order_by(ActivationRequest.id.desc()).limit(5)).unique())
    unread = db.scalar(select(func.count()).where(Notification.user_id == user.id, Notification.read_at.is_(None))) or 0
    activity = db.execute(select(BookingStatusHistory, Booking).join(Booking, Booking.id == BookingStatusHistory.booking_id)
                          .where(mine).order_by(BookingStatusHistory.id.desc()).limit(8)).all()
    # Recommended: resources bookable tomorrow afternoon (computed by the matching service, excludes own items)
    tomorrow = (now + timedelta(days=1)).replace(hour=10, minute=0, second=0, microsecond=0)
    rec = match(db, tomorrow, tomorrow + timedelta(hours=6), exclude_owner_id=user.id, limit=4)["matches"]
    db.commit()
    return {
        "counts": {"pending_incoming": pending_in, "pending_outgoing": pending_out, "awaiting_return_confirmation": awaiting_return,
                   "my_resources": my_res, "activation_requests": len(pending_act), "unread_notifications": unread},
        "upcoming_bookings": [booking_out(b, user) for b in upcoming],
        "activation_requests": [activation_out(a) for a in pending_act],
        "recent_activity": [{"booking_id": b.id, "to_status": h.to_status, "note": h.note, "created_at": h.created_at,
                             "resource_name": b.resource.name if b.resource else ""} for h, b in activity],
        "recommended": [{"score": m["score"], "reasons": m["reasons"][:3], "resource": resource_out(m["resource"], m["owner_stats"])} for m in rec],
        "recommended_window": {"start_at": tomorrow, "end_at": tomorrow + timedelta(hours=6)},
        "my_stats": user_stats(db, user.id),
    }
