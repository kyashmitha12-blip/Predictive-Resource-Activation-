from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.api.serializers import booking_out, page
from app.database import get_db
from app.models import (Booking, BookingStatus, ConditionReport, Report, ReportKind, Resource, Review, User)
from app.schemas.inputs import BookingIn, NotesIn, ReasonIn, ReportIn, ReviewIn
from app.security.deps import current_user, require_verified_student
from app.security.ratelimit import rate_limit
from app.services import bookings as svc
from app.services.core import notify, notify_admins
from app.storage import IMAGE_TYPES, get_storage, make_key, read_validated, sniff_type

router = APIRouter(prefix="/api", tags=["bookings"])
OPTS = (joinedload(Booking.resource).selectinload(Resource.images), joinedload(Booking.borrower), joinedload(Booking.owner),
        selectinload(Booking.history), selectinload(Booking.condition_reports))
CONDITIONS = {"as_expected", "minor_wear", "damaged"}


def _load(db: Session, bid: int, user: User) -> Booking:
    b = db.scalars(select(Booking).where(Booking.id == bid).options(*OPTS)).unique().one_or_none()
    if not b or (user.id not in (b.borrower_id, b.owner_id) and not user.is_admin):
        raise HTTPException(404, "Booking not found.")
    return b


def _reviewed(db: Session, bid: int, uid: int) -> bool:
    return bool(db.scalar(select(Review.id).where(Review.booking_id == bid, Review.reviewer_id == uid)))


def _out(db: Session, b: Booking, user: User, detail=False):
    return booking_out(b, user, _reviewed(db, b.id, user.id), detail)


async def _photos(files: list[UploadFile], booking_id: int) -> list[str]:
    keys = []
    for f in files[:4]:
        if not f.filename:
            continue
        data, ctype = await read_validated(f, IMAGE_TYPES)
        key = make_key(f"condition/{booking_id}", ctype)
        get_storage().put(key, data, ctype)
        keys.append(key)
    return keys


@router.post("/bookings", status_code=201, dependencies=[Depends(rate_limit("booking", 30, 3600))])
def create(body: BookingIn, user: User = Depends(require_verified_student), db: Session = Depends(get_db)):
    b = svc.create_booking(db, user, body.resource_id, body.start_at, body.end_at, body.note)
    return _out(db, _load(db, b.id, user), user, True)


def _listing(db: Session, user: User, role: str, status: str | None, page_no: int, size: int):
    col = Booking.borrower_id if role == "borrower" else Booking.owner_id
    stmt = select(Booking).where(col == user.id)
    if status:
        stmt = stmt.where(Booking.status.in_([s for s in BookingStatus if s.value in status.split(",")]))
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(stmt.options(*OPTS).order_by(Booking.created_at.desc()).limit(size).offset((page_no - 1) * size)).unique()
    return page([_out(db, b, user) for b in rows], total, page_no, size)


@router.get("/bookings/mine")
def mine(status: str | None = None, page_no: int = Query(1, alias="page", ge=1), page_size: int = Query(20, le=50),
         user: User = Depends(current_user), db: Session = Depends(get_db)):
    return _listing(db, user, "borrower", status, page_no, page_size)


@router.get("/bookings/incoming")
def incoming(status: str | None = None, page_no: int = Query(1, alias="page", ge=1), page_size: int = Query(20, le=50),
             user: User = Depends(current_user), db: Session = Depends(get_db)):
    return _listing(db, user, "owner", status, page_no, page_size)


@router.get("/bookings/{bid}")
def detail(bid: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return _out(db, _load(db, bid, user), user, True)


def _act(db, bid, user):
    return svc.get_for_party(db, bid, user)


@router.post("/bookings/{bid}/approve")
def approve(bid: int, user: User = Depends(require_verified_student), db: Session = Depends(get_db)):
    svc.approve(db, _act(db, bid, user), user)
    return _out(db, _load(db, bid, user), user, True)


@router.post("/bookings/{bid}/reject")
def reject(bid: int, body: ReasonIn, user: User = Depends(require_verified_student), db: Session = Depends(get_db)):
    svc.reject(db, _act(db, bid, user), user, body.reason)
    return _out(db, _load(db, bid, user), user, True)


@router.post("/bookings/{bid}/cancel")
def cancel(bid: int, body: ReasonIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    svc.cancel(db, _act(db, bid, user), user, body.reason)
    return _out(db, _load(db, bid, user), user, True)


@router.post("/bookings/{bid}/handover")
def handover(bid: int, body: NotesIn, user: User = Depends(require_verified_student), db: Session = Depends(get_db)):
    svc.handover(db, _act(db, bid, user), user, body.notes)
    return _out(db, _load(db, bid, user), user, True)


async def _condition_form(condition: str, notes: str, files: list[UploadFile], bid: int):
    if condition not in CONDITIONS:
        raise HTTPException(422, "Condition must be as_expected, minor_wear or damaged.")
    if len(notes) > 1000:
        raise HTTPException(422, "Notes are too long (max 1000 characters).")
    return await _photos(files, bid)


@router.post("/bookings/{bid}/return")
async def return_it(bid: int, condition: str = Form("as_expected"), notes: str = Form(""), photos: list[UploadFile] = File(default=[]),
                    user: User = Depends(require_verified_student), db: Session = Depends(get_db)):
    b = _act(db, bid, user)
    keys = await _condition_form(condition, notes, photos, bid)
    svc.report_return(db, b, user, condition, notes.strip(), keys)
    return _out(db, _load(db, bid, user), user, True)


@router.post("/bookings/{bid}/confirm-return")
async def confirm_return(bid: int, condition: str = Form("as_expected"), notes: str = Form(""), photos: list[UploadFile] = File(default=[]),
                         user: User = Depends(require_verified_student), db: Session = Depends(get_db)):
    b = _act(db, bid, user)
    keys = await _condition_form(condition, notes, photos, bid)
    svc.confirm_return(db, b, user, condition, notes.strip(), keys)
    return _out(db, _load(db, bid, user), user, True)


@router.get("/bookings/{bid}/photos/{report_id}/{index}")
def photo(bid: int, report_id: int, index: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    b = _load(db, bid, user)
    rep = db.get(ConditionReport, report_id)
    if not rep or rep.booking_id != b.id or not (0 <= index < len(rep.photo_keys or [])):
        raise HTTPException(404, "Photo not found.")
    data = get_storage().get(rep.photo_keys[index])
    if data is None:
        raise HTTPException(404, "Photo not found.")
    return Response(data, media_type=sniff_type(data) or "application/octet-stream",
                    headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"})


@router.post("/bookings/{bid}/report", status_code=201, dependencies=[Depends(rate_limit("booking_report", 10, 3600))])
def report_issue(bid: int, body: ReportIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    b = _load(db, bid, user)
    if user.id not in (b.borrower_id, b.owner_id):
        raise HTTPException(403, "Only the people in this booking can report an issue.")
    db.add(Report(reporter_id=user.id, kind=ReportKind.dispute, target_type="booking", target_id=b.id, booking_id=b.id, description=body.description))
    notify_admins(db, "dispute_opened", "A booking issue was reported", f"Booking #{b.id}: {body.description[:120]}", "/admin/reports")
    db.commit()
    return {"ok": True}


# ---- reviews ---------------------------------------------------------------------------------------------
@router.post("/bookings/{bid}/reviews", status_code=201)
def review(bid: int, body: ReviewIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    b = _load(db, bid, user)
    if user.id not in (b.borrower_id, b.owner_id):
        raise HTTPException(403, "Only the people in this booking can review it.")
    if b.status != BookingStatus.completed:
        raise HTTPException(409, "You can review after the rental is completed.")
    if _reviewed(db, bid, user.id):
        raise HTTPException(409, "You have already reviewed this booking.")
    reviewee = b.owner_id if user.id == b.borrower_id else b.borrower_id
    rv = Review(booking_id=bid, reviewer_id=user.id, reviewee_id=reviewee, rating=body.rating, comment=body.comment)
    db.add(rv)
    notify(db, reviewee, "review_received", f"{user.name} left you a {body.rating}-star review", body.comment[:140], "/app/reviews")
    db.commit()
    return {"id": rv.id}


def _review_out(rv: Review):
    return {"id": rv.id, "booking_id": rv.booking_id, "rating": rv.rating, "comment": rv.comment, "created_at": rv.created_at,
            "reviewer": {"id": rv.reviewer.id, "name": rv.reviewer.name}, "reviewee": {"id": rv.reviewee.id, "name": rv.reviewee.name}}


@router.get("/bookings/{bid}/reviews")
def booking_reviews(bid: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    _load(db, bid, user)
    return [_review_out(r) for r in db.scalars(select(Review).where(Review.booking_id == bid).options(joinedload(Review.reviewer), joinedload(Review.reviewee)))]


@router.get("/reviews/mine")
def my_reviews(user: User = Depends(current_user), db: Session = Depends(get_db)):
    base = select(Review).options(joinedload(Review.reviewer), joinedload(Review.reviewee)).order_by(Review.id.desc())
    pending = db.scalars(select(Booking).where(Booking.status == BookingStatus.completed, or_(Booking.borrower_id == user.id, Booking.owner_id == user.id))
                         .options(*OPTS).order_by(Booking.completed_at.desc())).unique()
    return {"received": [_review_out(r) for r in db.scalars(base.where(Review.reviewee_id == user.id))],
            "given": [_review_out(r) for r in db.scalars(base.where(Review.reviewer_id == user.id))],
            "awaiting_my_review": [booking_out(b, user, False) for b in pending if not _reviewed(db, b.id, user.id)]}


@router.get("/users/{uid}/reviews")
def user_reviews(uid: int, _: User = Depends(current_user), db: Session = Depends(get_db)):
    q = select(Review).where(Review.reviewee_id == uid).options(joinedload(Review.reviewer), joinedload(Review.reviewee)).order_by(Review.id.desc()).limit(50)
    return [_review_out(r) for r in db.scalars(q)]
