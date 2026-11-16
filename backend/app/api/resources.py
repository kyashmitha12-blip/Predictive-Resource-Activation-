from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.api.serializers import booking_out, page, resource_out
from app.database import get_db
from app.models import (AccountStatus, Booking, BookingStatus, Condition, Report, ReportKind, Resource,
                        ResourceAvailability, ResourceImage, ResourceStatus, Role, User, VerificationStatus)
from app.models.base import CATEGORIES, CATEGORY_LABELS
from app.schemas.inputs import AvailabilityIn, ReportIn, ResourceCreate, ResourceUpdate
from app.security.deps import current_user, optional_user, require_verified_student
from app.security.ratelimit import rate_limit
from app.services import bookings as booking_svc
from app.services.availability import BLOCKING, check_availability, rental_amount
from app.services.core import audit, notify, notify_admins
from app.services.reliability import user_stats
from app.storage import IMAGE_TYPES, get_storage, make_key, read_validated

router = APIRouter(prefix="/api/resources", tags=["resources"])
OPTS = (joinedload(Resource.owner), selectinload(Resource.images), selectinload(Resource.availability))
MAX_IMAGES = 6


def _owned(db: Session, rid: int, user: User) -> Resource:
    r = db.get(Resource, rid)
    if not r or r.status == ResourceStatus.removed and user.role != Role.admin or (r.owner_id != user.id and user.role != Role.admin):
        raise HTTPException(404, "Resource not found.")
    return r


def _public_filter():
    return (Resource.status == ResourceStatus.active,)


@router.get("/categories")
def categories(db: Session = Depends(get_db)):
    counts = dict(db.execute(select(Resource.category, func.count()).where(*_public_filter()).group_by(Resource.category)).all())
    return [{"value": c, "label": CATEGORY_LABELS[c], "count": counts.get(c, 0)} for c in CATEGORIES]


@router.get("")
def list_resources(q: str | None = Query(None, max_length=100), category: str | None = None, min_price: float | None = Query(None, ge=0),
                   max_price: float | None = Query(None, ge=0), free_only: bool = False, condition: Condition | None = None,
                   area: str | None = Query(None, max_length=100), available_from: datetime | None = None,
                   available_to: datetime | None = None, sort: str = Query("newest", pattern="^(newest|price_asc|price_desc|name)$"),
                   page_no: int = Query(1, alias="page", ge=1), page_size: int = Query(12, ge=1, le=48), db: Session = Depends(get_db)):
    stmt = select(Resource).where(*_public_filter())
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Resource.name.ilike(like), Resource.description.ilike(like)))
    if category:
        stmt = stmt.where(Resource.category == category)
    if free_only:
        stmt = stmt.where(Resource.price_per_day == 0)
    if min_price is not None:
        stmt = stmt.where(Resource.price_per_day >= min_price)
    if max_price is not None:
        stmt = stmt.where(Resource.price_per_day <= max_price)
    if condition:
        stmt = stmt.where(Resource.condition == condition)
    if area:
        stmt = stmt.where(Resource.pickup_area.ilike(f"%{area.strip()}%"))
    stmt = stmt.order_by({"newest": Resource.created_at.desc(), "price_asc": Resource.price_per_day.asc(),
                          "price_desc": Resource.price_per_day.desc(), "name": Resource.name.asc()}[sort], Resource.id)
    if available_from and available_to:
        if available_from.tzinfo is None or available_to.tzinfo is None:
            raise HTTPException(422, "available_from/available_to need a timezone offset.")
        rows = [r for r in db.scalars(stmt.options(*OPTS)).unique() if not check_availability(db, r, available_from, available_to)]
        total, rows = len(rows), rows[(page_no - 1) * page_size: page_no * page_size]
    else:
        total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery()))
        rows = list(db.scalars(stmt.options(*OPTS).limit(page_size).offset((page_no - 1) * page_size)).unique())
    return page([resource_out(r) for r in rows], total, page_no, page_size)


@router.get("/mine")
def my_resources(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Resource).where(Resource.owner_id == user.id, Resource.status != ResourceStatus.archived,
                                             Resource.status != ResourceStatus.removed).options(*OPTS)
                      .order_by(Resource.created_at.desc())).unique()
    out = []
    for r in rows:
        d = resource_out(r, detail=True)
        d["booking_count"] = db.scalar(select(func.count()).where(Booking.resource_id == r.id, Booking.status == BookingStatus.completed)) or 0
        d["pending_requests"] = db.scalar(select(func.count()).where(Booking.resource_id == r.id, Booking.status == BookingStatus.requested)) or 0
        out.append(d)
    return out


@router.post("", status_code=201, dependencies=[Depends(rate_limit("create_resource", 30, 3600))])
def create_resource(body: ResourceCreate, user: User = Depends(require_verified_student), db: Session = Depends(get_db)):
    data = body.model_dump(exclude={"availability"})
    r = Resource(owner_id=user.id, status=ResourceStatus.active, **data)
    db.add(r)
    db.flush()
    for w in body.availability:
        db.add(ResourceAvailability(resource_id=r.id, start_at=w.start_at, end_at=w.end_at, source="owner"))
    audit(db, user, "resource.create", "resource", r.id)
    db.commit()
    db.refresh(r)
    return resource_out(db.scalars(select(Resource).where(Resource.id == r.id).options(*OPTS)).unique().one(), detail=True)


@router.get("/{rid}")
def get_resource(rid: int, db: Session = Depends(get_db), user: User | None = Depends(optional_user)):
    r = db.scalars(select(Resource).where(Resource.id == rid).options(*OPTS)).unique().one_or_none()
    visible = r and (r.status == ResourceStatus.active or (user and (r.owner_id == user.id or user.role == Role.admin)))
    if not visible:
        raise HTTPException(404, "Resource not found.")
    out = resource_out(r, user_stats(db, r.owner_id), detail=True)
    out["blocked"] = [{"start_at": b.start_at, "end_at": b.end_at} for b in db.scalars(
        select(Booking).where(Booking.resource_id == rid, Booking.status.in_(BLOCKING), Booking.end_at > datetime.now(timezone.utc)))]
    out["completed_rentals"] = db.scalar(select(func.count()).where(Booking.resource_id == rid, Booking.status == BookingStatus.completed)) or 0
    return out


@router.get("/{rid}/check")
def check(rid: int, start: datetime, end: datetime, db: Session = Depends(get_db), _: User = Depends(current_user)):
    if start.tzinfo is None or end.tzinfo is None:
        raise HTTPException(422, "start/end need a timezone offset.")
    r = db.scalars(select(Resource).where(Resource.id == rid).options(*OPTS)).unique().one_or_none()
    if not r or r.status != ResourceStatus.active:
        raise HTTPException(404, "Resource not found.")
    reasons = check_availability(db, r, start, end)
    ok = not reasons
    return {"bookable": ok, "reasons": reasons, "estimated_cost": float(rental_amount(r, start, end)) if end > start else 0,
            "deposit": float(r.deposit), "payment_notice": "DEMO payment - no real money is charged or held."}


@router.patch("/{rid}")
def update_resource(rid: int, body: ResourceUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    r = _owned(db, rid, user)
    if r.status in (ResourceStatus.removed, ResourceStatus.archived):
        raise HTTPException(409, "This resource is no longer editable.")
    changes = body.model_dump(exclude_unset=True)
    if "status" in changes and changes["status"] != "active":
        if db.scalar(select(Booking.id).where(Booking.resource_id == rid, Booking.status.in_(BLOCKING), Booking.end_at > datetime.now(timezone.utc))):
            raise HTTPException(409, "There are confirmed bookings. Cancel them first or wait until they finish.")
    for k, v in changes.items():
        setattr(r, k, ResourceStatus(v) if k == "status" else v)
    audit(db, user, "resource.update", "resource", r.id, fields=sorted(changes))
    db.commit()
    return resource_out(db.scalars(select(Resource).where(Resource.id == rid).options(*OPTS)).unique().one(), detail=True)


@router.delete("/{rid}")
def archive_resource(rid: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    r = _owned(db, rid, user)
    if db.scalar(select(Booking.id).where(Booking.resource_id == rid, Booking.status.in_((BookingStatus.confirmed, BookingStatus.active, BookingStatus.returned)))):
        raise HTTPException(409, "This resource has confirmed or active bookings and cannot be removed yet.")
    for b in db.scalars(select(Booking).where(Booking.resource_id == rid, Booking.status == BookingStatus.requested)):
        booking_svc._move(db, b, BookingStatus.rejected, user, "Resource was removed by the owner")
        notify(db, b.borrower_id, "booking_rejected", "A booking request was closed", f"{r.name} is no longer listed.", f"/app/bookings/{b.id}")
    r.status = ResourceStatus.archived
    audit(db, user, "resource.archive", "resource", r.id)
    db.commit()
    return {"ok": True}


# ---- images -----------------------------------------------------------------------------------------------
@router.post("/{rid}/images", status_code=201)
async def upload_image(rid: int, file: UploadFile = File(...), user: User = Depends(current_user), db: Session = Depends(get_db)):
    r = _owned(db, rid, user)
    if len(r.images) >= MAX_IMAGES:
        raise HTTPException(409, f"A resource can have at most {MAX_IMAGES} photos.")
    data, ctype = await read_validated(file, IMAGE_TYPES)
    key = make_key(f"resources/{rid}", ctype)
    get_storage().put(key, data, ctype)
    img = ResourceImage(resource_id=rid, storage_key=key, content_type=ctype, position=len(r.images))
    db.add(img)
    db.commit()
    return {"id": img.id, "url": f"/api/resources/{rid}/images/{img.id}"}


@router.get("/{rid}/images/{image_id}")
def get_image(rid: int, image_id: int, db: Session = Depends(get_db)):
    img = db.get(ResourceImage, image_id)
    if not img or img.resource_id != rid:
        raise HTTPException(404, "Image not found.")
    data = get_storage().get(img.storage_key)
    if data is None:
        raise HTTPException(404, "Image not found.")
    return Response(data, media_type=img.content_type, headers={"Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff"})


@router.delete("/{rid}/images/{image_id}")
def delete_image(rid: int, image_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    _owned(db, rid, user)
    img = db.get(ResourceImage, image_id)
    if not img or img.resource_id != rid:
        raise HTTPException(404, "Image not found.")
    get_storage().delete(img.storage_key)
    db.delete(img)
    db.commit()
    return {"ok": True}


# ---- availability -----------------------------------------------------------------------------------------
@router.post("/{rid}/availability", status_code=201)
def add_window(rid: int, body: AvailabilityIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    r = _owned(db, rid, user)
    if body.end_at <= datetime.now(timezone.utc):
        raise HTTPException(422, "The availability window must end in the future.")
    w = ResourceAvailability(resource_id=r.id, start_at=body.start_at, end_at=body.end_at, source="owner")
    db.add(w)
    db.commit()
    return {"id": w.id, "start_at": w.start_at, "end_at": w.end_at, "source": w.source}


@router.delete("/{rid}/availability/{wid}")
def remove_window(rid: int, wid: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    r = _owned(db, rid, user)
    w = db.get(ResourceAvailability, wid)
    if not w or w.resource_id != r.id:
        raise HTTPException(404, "Availability window not found.")
    if db.scalar(select(Booking.id).where(Booking.resource_id == r.id, Booking.status.in_(BLOCKING), Booking.start_at < w.end_at, Booking.end_at > w.start_at)):
        raise HTTPException(409, "A booking is already confirmed in this period, so it can no longer be withdrawn.")
    db.delete(w)
    db.commit()
    return {"ok": True}


@router.post("/{rid}/report", status_code=201, dependencies=[Depends(rate_limit("report", 10, 3600))])
def report_resource(rid: int, body: ReportIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    r = db.get(Resource, rid)
    if not r:
        raise HTTPException(404, "Resource not found.")
    db.add(Report(reporter_id=user.id, kind=ReportKind.complaint, target_type="resource", target_id=rid, description=body.description))
    notify_admins(db, "report_filed", "A listing was reported", f"{r.name}: {body.description[:120]}", "/admin/reports")
    db.commit()
    return {"ok": True}
