from datetime import date, datetime, timedelta, timezone

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.api.serializers import activation_out, booking_out, page, resource_out, user_out
from app.database import get_db
from app.ml.forecasting import monday_of
from app.models import (AccountStatus, ActivationRequest, ActivationStatus, AuditLog, Booking, BookingStatus, DemandForecast,
                        PlatformSetting, PredictionEvaluation, Report, ReportStatus, Resource, ResourceStatus, Role, User,
                        VerificationStatus, VerificationSubmission)
from app.models.base import CATEGORIES, CATEGORY_LABELS
from app.schemas.inputs import (GenerateActivationIn, ModerationIn, ReportResolveIn, SettingsUpdate, UserAdminUpdate,
                                VerificationDecisionIn)
from app.security.deps import require_admin
from app.services import activation as act
from app.services import bookings as booking_svc
from app.services import forecast_service
from app.services.core import DEFAULT_SETTINGS, audit, get_settings_map, notify
from app.services.idle import candidates
from app.services.supply import effective_supply, period_bounds

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


# ---- overview --------------------------------------------------------------------------------------------
@router.get("/overview")
def overview(db: Session = Depends(get_db)):
    users = dict(db.execute(select(User.verification_status, func.count()).where(User.role == Role.student).group_by(User.verification_status)).all())
    total_users = db.scalar(select(func.count()).select_from(User))
    bstat = dict(db.execute(select(Booking.status, func.count()).group_by(Booking.status)).all())
    g = lambda s: bstat.get(s, 0)  # noqa: E731
    closed = g(BookingStatus.completed) + g(BookingStatus.cancelled) + g(BookingStatus.rejected) + g(BookingStatus.disputed)
    since = datetime.now(timezone.utc) - timedelta(days=30)
    daily = db.execute(select(func.date_trunc("day", Booking.created_at).label("d"), func.count(), func.count().filter(Booking.is_demo.is_(True)))
                       .where(Booking.created_at > since).group_by("d").order_by("d")).all()
    acts = dict(db.execute(select(ActivationRequest.status, func.count()).group_by(ActivationRequest.status)).all())
    acc, dec = acts.get(ActivationStatus.accepted, 0), acts.get(ActivationStatus.declined, 0)
    fc = forecast_service.summary(db)
    cands = 0
    if fc:
        sup = effective_supply(db, fc["period_start"], fc["period_end"])
        for c in fc["categories"]:
            if c["supply_gap"] > 0:
                cands += len(candidates(db, c["category"], fc["period_start"], fc["period_end"], sup))
    return {
        "users": {"total": total_users, "students": sum(users.values()), "verified": users.get(VerificationStatus.approved, 0),
                  "pending": users.get(VerificationStatus.pending, 0), "rejected": users.get(VerificationStatus.rejected, 0),
                  "not_submitted": users.get(VerificationStatus.not_submitted, 0)},
        "resources": {"active": db.scalar(select(func.count()).where(Resource.status == ResourceStatus.active)),
                      "total": db.scalar(select(func.count()).select_from(Resource)),
                      "demo": db.scalar(select(func.count()).where(Resource.is_demo.is_(True)))},
        "bookings": {"by_status": {k.value: v for k, v in bstat.items()}, "total": sum(bstat.values()),
                     "completion_rate": round(g(BookingStatus.completed) / closed, 3) if closed else None,
                     "cancellation_rate": round(g(BookingStatus.cancelled) / closed, 3) if closed else None,
                     "demo": db.scalar(select(func.count()).where(Booking.is_demo.is_(True)))},
        "activity": [{"date": d.date().isoformat(), "bookings": n, "demo": dn} for d, n, dn in daily],
        "activation": {"by_status": {k.value: v for k, v in acts.items()}, "total": sum(acts.values()),
                       "acceptance_rate": round(acc / (acc + dec), 3) if (acc + dec) else None,
                       "eligible_idle_resources": cands},
        "forecast": fc,
        "open_reports": db.scalar(select(func.count()).where(Report.status == ReportStatus.open)),
        "pending_verifications": users.get(VerificationStatus.pending, 0),
    }


# ---- verification ----------------------------------------------------------------------------------------
@router.get("/verifications")
def verifications(status: str = "pending", page_no: int = Query(1, alias="page", ge=1), page_size: int = Query(20, le=50), db: Session = Depends(get_db)):
    stmt = select(VerificationSubmission).options(joinedload(VerificationSubmission.user))
    if status != "all":
        stmt = stmt.where(VerificationSubmission.status == VerificationStatus(status))
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery()))
    rows = db.scalars(stmt.order_by(VerificationSubmission.id.desc()).limit(page_size).offset((page_no - 1) * page_size)).unique()
    return page([{"id": s.id, "status": s.status.value, "college": s.college, "student_id_number": s.student_id_number, "note": s.note,
                  "submitted_at": s.created_at, "reviewed_at": s.reviewed_at, "decision_reason": s.decision_reason,
                  "has_document": bool(s.document_key), "document_url": f"/api/verification/{s.id}/document",
                  "user": {"id": s.user.id, "name": s.user.name, "email": s.user.email, "student_id": s.user.student_id,
                           "department": s.user.department, "email_verified": s.user.email_verified_at is not None}} for s in rows],
                total, page_no, page_size)


@router.post("/verifications/{sid}/decision")
def decide(sid: int, body: VerificationDecisionIn, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    s = db.get(VerificationSubmission, sid)
    if not s:
        raise HTTPException(404, "Submission not found.")
    if s.status != VerificationStatus.pending:
        raise HTTPException(409, f"This submission was already {s.status.value}.")
    if not body.approve and not body.reason.strip():
        raise HTTPException(422, "Please give a reason when rejecting.")
    user = db.get(User, s.user_id)
    s.status = VerificationStatus.approved if body.approve else VerificationStatus.rejected
    s.reviewed_by, s.reviewed_at, s.decision_reason = admin.id, datetime.now(timezone.utc), body.reason
    user.verification_status, user.verification_reason = s.status, (body.reason or None)
    audit(db, admin, "verification.approve" if body.approve else "verification.reject", "user", user.id, reason=body.reason)
    notify(db, user.id, "verification_result", "Your student verification was " + ("approved" if body.approve else "rejected"),
           "You can now list resources and book." if body.approve else f"Reason: {body.reason}. You can submit again.", "/app/profile")
    db.commit()
    return {"id": s.id, "status": s.status.value}


# ---- users -----------------------------------------------------------------------------------------------
@router.get("/users")
def users(q: str | None = None, role: str | None = None, status: str | None = None, verification: str | None = None,
          page_no: int = Query(1, alias="page", ge=1), page_size: int = Query(20, le=50), db: Session = Depends(get_db)):
    stmt = select(User)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(User.name.ilike(like), User.email.ilike(like), User.student_id.ilike(like)))
    if role:
        stmt = stmt.where(User.role == Role(role))
    if status:
        stmt = stmt.where(User.account_status == AccountStatus(status))
    if verification:
        stmt = stmt.where(User.verification_status == VerificationStatus(verification))
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(stmt.order_by(User.id.desc()).limit(page_size).offset((page_no - 1) * page_size))
    return page([user_out(u) for u in rows], total, page_no, page_size)


@router.patch("/users/{uid}")
def update_user(uid: int, body: UserAdminUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    u = db.get(User, uid)
    if not u:
        raise HTTPException(404, "User not found.")
    if u.id == admin.id:
        raise HTTPException(409, "You cannot change your own account status.")
    u.account_status = AccountStatus(body.account_status)
    audit(db, admin, "user.status", "user", u.id, status=body.account_status, reason=body.reason)
    db.commit()
    return user_out(u)


# ---- resource moderation ---------------------------------------------------------------------------------
@router.get("/resources")
def resources(q: str | None = None, status: str | None = None, page_no: int = Query(1, alias="page", ge=1), page_size: int = Query(20, le=50),
              db: Session = Depends(get_db)):
    stmt = select(Resource)
    if q:
        stmt = stmt.where(Resource.name.ilike(f"%{q.strip()}%"))
    if status:
        stmt = stmt.where(Resource.status == ResourceStatus(status))
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(stmt.options(joinedload(Resource.owner), selectinload(Resource.images), selectinload(Resource.availability))
                      .order_by(Resource.id.desc()).limit(page_size).offset((page_no - 1) * page_size)).unique()
    open_reports = dict(db.execute(select(Report.target_id, func.count()).where(Report.target_type == "resource", Report.status == ReportStatus.open).group_by(Report.target_id)).all())
    return page([{**resource_out(r), "open_reports": open_reports.get(r.id, 0), "owner_email": r.owner.email} for r in rows], total, page_no, page_size)


@router.post("/resources/{rid}/moderate")
def moderate(rid: int, body: ModerationIn, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    r = db.get(Resource, rid)
    if not r:
        raise HTTPException(404, "Resource not found.")
    if body.action == "remove":
        if db.scalar(select(Booking.id).where(Booking.resource_id == rid, Booking.status.in_((BookingStatus.active, BookingStatus.returned)))):
            raise HTTPException(409, "A rental is in progress. Resolve it before removing the listing.")
        for b in db.scalars(select(Booking).where(Booking.resource_id == rid, Booking.status.in_((BookingStatus.requested, BookingStatus.confirmed)))):
            booking_svc._move(db, b, BookingStatus.cancelled, admin, "Listing removed by moderation")
            for uid in (b.borrower_id, b.owner_id):
                notify(db, uid, "booking_cancelled", "A booking was cancelled by moderation", f"{r.name} was removed from the platform.", f"/app/bookings/{b.id}")
        r.status, r.moderation_note = ResourceStatus.removed, body.note
        notify(db, r.owner_id, "listing_removed", f"Your listing {r.name} was removed", body.note or "It did not meet platform rules.", "/app/resources")
    else:
        r.status, r.moderation_note = ResourceStatus.inactive, None
        notify(db, r.owner_id, "listing_restored", f"Your listing {r.name} was restored", "It is paused until you make it available again.", "/app/resources")
    audit(db, admin, f"resource.{body.action}", "resource", r.id, note=body.note)
    db.commit()
    return {"id": r.id, "status": r.status.value}


# ---- bookings --------------------------------------------------------------------------------------------
@router.get("/bookings")
def bookings(status: str | None = None, q: str | None = None, page_no: int = Query(1, alias="page", ge=1), page_size: int = Query(20, le=50),
             admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    stmt = select(Booking).join(Resource, Resource.id == Booking.resource_id)
    if status:
        stmt = stmt.where(Booking.status == BookingStatus(status))
    if q:
        stmt = stmt.where(Resource.name.ilike(f"%{q.strip()}%"))
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(stmt.options(joinedload(Booking.resource).selectinload(Resource.images), joinedload(Booking.borrower), joinedload(Booking.owner))
                      .order_by(Booking.id.desc()).limit(page_size).offset((page_no - 1) * page_size)).unique()
    return page([booking_out(b, admin) for b in rows], total, page_no, page_size)


# ---- reports & disputes ----------------------------------------------------------------------------------
@router.get("/reports")
def reports(status: str = "open", page_no: int = Query(1, alias="page", ge=1), page_size: int = Query(20, le=50), db: Session = Depends(get_db)):
    stmt = select(Report).options(joinedload(Report.reporter))
    if status != "all":
        stmt = stmt.where(Report.status == ReportStatus(status))
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery()))
    rows = list(db.scalars(stmt.order_by(Report.id.desc()).limit(page_size).offset((page_no - 1) * page_size)).unique())
    out = []
    for r in rows:
        target, bstatus = "", None
        if r.target_type == "resource":
            res = db.get(Resource, r.target_id)
            target = res.name if res else "(deleted)"
        elif r.booking_id:
            b = db.get(Booking, r.booking_id)
            bstatus = b.status.value if b else None
            target = f"Booking #{r.booking_id}" + (f" - {b.resource.name}" if b else "")
        out.append({"id": r.id, "kind": r.kind.value, "target_type": r.target_type, "target_id": r.target_id, "target": target,
                    "booking_id": r.booking_id, "booking_status": bstatus, "description": r.description, "status": r.status.value,
                    "resolution": r.resolution, "created_at": r.created_at, "reporter": {"id": r.reporter.id, "name": r.reporter.name}})
    return page(out, total, page_no, page_size)


@router.post("/reports/{rid}/resolve")
def resolve_report(rid: int, body: ReportResolveIn, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    r = db.get(Report, rid)
    if not r:
        raise HTTPException(404, "Report not found.")
    if r.status != ReportStatus.open:
        raise HTTPException(409, "This report is already closed.")
    if r.booking_id:
        b = db.get(Booking, r.booking_id)
        if b and b.status == BookingStatus.disputed:
            if not body.deposit_outcome:
                raise HTTPException(422, "Choose what happens to the (demo) deposit for this disputed booking.")
            booking_svc.resolve_dispute(db, b, admin, body.deposit_outcome, body.resolution)
    r.status = ReportStatus.dismissed if body.dismiss else ReportStatus.resolved
    r.resolution, r.resolved_by, r.resolved_at = body.resolution, admin.id, datetime.now(timezone.utc)
    notify(db, r.reporter_id, "report_resolved", "Your report was reviewed", body.resolution[:200], None)
    audit(db, admin, "report.resolve", "report", r.id, dismissed=body.dismiss)
    db.commit()
    return {"id": r.id, "status": r.status.value}


# ---- forecasting, supply gap, idle, activation -----------------------------------------------------------
@router.post("/forecast/run")
def run_forecast_now(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    try:
        run_id = forecast_service.run(db, admin)
    except ValueError as exc:
        raise HTTPException(409, str(exc))
    return forecast_service.summary(db, run_id)


@router.get("/forecast/latest")
def forecast_latest(db: Session = Depends(get_db)):
    s = forecast_service.summary(db)
    return {"available": bool(s), **(s or {}), "data": forecast_service.build_history(db)[1]}


@router.get("/forecast/history")
def forecast_history(db: Session = Depends(get_db)):
    rows = db.execute(select(PredictionEvaluation).where(PredictionEvaluation.is_selected.is_(True)).order_by(PredictionEvaluation.id.desc()).limit(20)).scalars()
    return [{"run_id": e.run_id, "model_name": e.model_name, "model_version": e.model_version, "mae": e.mae, "rmse": e.rmse,
             "n_real_weeks": e.n_real_weeks, "n_synthetic_weeks": e.n_synthetic_weeks, "created_at": e.created_at} for e in rows]


@router.get("/forecast/history-series")
def history_series(category: str, weeks: int = Query(26, ge=4, le=104), db: Session = Depends(get_db)):
    df, _ = forecast_service.build_history(db)
    if df.empty:
        return []
    df = df[df.category == category].sort_values("week_start").tail(weeks)
    return [{"week_start": str(w), "bookings": int(b), "event": bool(e)} for w, b, e in zip(df.week_start, df.bookings, df.event_flag)]


@router.get("/supply-gap")
def supply_gap_analysis(db: Session = Depends(get_db)):
    s = forecast_service.summary(db)
    if not s:
        return {"available": False}
    sup = effective_supply(db, s["period_start"], s["period_end"])
    rows = []
    for c in s["categories"]:
        cand = len(candidates(db, c["category"], s["period_start"], s["period_end"], sup)) if c["supply_gap"] > 0 else 0
        rows.append({**c, "label": CATEGORY_LABELS[c["category"]], "eligible_idle": cand})
    return {"available": True, "run_id": s["run_id"], "period_start": s["period_start"], "period_end": s["period_end"],
            "data_basis": s["data_basis"], "data_note": s["data_note"], "categories": rows,
            "definition": "Supply gap = max(0, round(predicted demand) - effective available supply). Effective supply counts each eligible resource once."}


@router.get("/idle-resources")
def idle_resources(db: Session = Depends(get_db)):
    s = forecast_service.summary(db)
    if s:
        ps, pe = s["period_start"], s["period_end"]
    else:
        ps = monday_of(date.today()) + timedelta(weeks=1)
        pe = ps + timedelta(days=6)
    sup = effective_supply(db, ps, pe)
    gap = {c["category"]: c["supply_gap"] for c in (s["categories"] if s else [])}
    out = []
    for cat in CATEGORIES:
        for c in candidates(db, cat, ps, pe, sup):
            r, m = c["resource"], c["metrics"]
            out.append({"resource_id": r.id, "name": r.name, "category": cat, "category_label": CATEGORY_LABELS[cat], "condition": r.condition.value,
                        "owner": {"id": c["owner"].id, "name": c["owner"].name}, **m, "score": c["score"], "score_breakdown": c["score_breakdown"],
                        "opportunity": c["opportunity"], "category_gap": gap.get(cat, 0), "pickup_area": r.pickup_area})
    out.sort(key=lambda x: (-x["category_gap"], -x["score"]))
    return {"period_start": ps, "period_end": pe, "items": out, "thresholds": {k: get_settings_map(db)[k] for k in
            ("idle_days_threshold", "utilization_window_days", "utilization_threshold", "max_requests_per_owner_per_week", "overask_factor")}}


@router.post("/activation/generate")
def generate_activation(body: GenerateActivationIn, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return act.generate_requests(db, admin, categories=body.categories)


@router.get("/activation")
def activation_list(status: str | None = None, db: Session = Depends(get_db)):
    act.expire_stale(db)
    db.commit()
    stmt = select(ActivationRequest).options(joinedload(ActivationRequest.resource).selectinload(Resource.images), joinedload(ActivationRequest.owner)).order_by(ActivationRequest.id.desc()).limit(200)
    if status:
        stmt = stmt.where(ActivationRequest.status == ActivationStatus(status))
    items = [{**activation_out(a), "owner": {"id": a.owner.id, "name": a.owner.name}} for a in db.scalars(stmt).unique()]
    counts = dict(db.execute(select(ActivationRequest.status, func.count()).group_by(ActivationRequest.status)).all())
    g = lambda s: counts.get(s, 0)  # noqa: E731
    answered = g(ActivationStatus.accepted) + g(ActivationStatus.declined) + g(ActivationStatus.withdrawn)
    return {"items": items, "stats": {"total": sum(counts.values()), **{k.value: v for k, v in counts.items()},
            "acceptance_rate": round(g(ActivationStatus.accepted) / answered, 3) if answered else None,
            "response_rate": round(answered / max(1, sum(counts.values()) - g(ActivationStatus.expired)), 3)}}


# ---- audit logs & settings --------------------------------------------------------------------------------
@router.get("/audit-logs")
def audit_logs(action: str | None = None, page_no: int = Query(1, alias="page", ge=1), page_size: int = Query(30, le=100), db: Session = Depends(get_db)):
    stmt = select(AuditLog).options(joinedload(AuditLog.actor))
    if action:
        stmt = stmt.where(AuditLog.action.like(f"{action}%"))
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery()))
    rows = db.scalars(stmt.order_by(AuditLog.id.desc()).limit(page_size).offset((page_no - 1) * page_size)).unique()
    return page([{"id": a.id, "action": a.action, "entity_type": a.entity_type, "entity_id": a.entity_id, "details": a.details,
                  "created_at": a.created_at, "actor": {"id": a.actor.id, "name": a.actor.name} if a.actor else None} for a in rows], total, page_no, page_size)


SETTING_HELP = {
    "idle_days_threshold": "Days without use before a resource counts as idle",
    "utilization_window_days": "Window used to compute utilization",
    "utilization_threshold": "Utilization (0-1) below which a resource counts as idle",
    "max_requests_per_owner_per_week": "Maximum activation requests an owner receives per week",
    "overask_factor": "Ask this many times the gap, because some owners decline",
    "units_per_resource": "Bookings one resource is assumed to serve per forecast week",
    "request_valid_days": "How long an activation request stays open",
}


@router.get("/settings")
def get_settings(db: Session = Depends(get_db)):
    cfg = get_settings_map(db)
    ev = db.get(PlatformSetting, "event_weeks")
    return {"values": {k: cfg[k] for k in SETTING_HELP}, "help": SETTING_HELP, "event_weeks": (ev.value if ev else []) or []}


@router.put("/settings")
def put_settings(body: SettingsUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    for k, v in body.values.items():
        if k == "event_weeks":
            try:
                [date.fromisoformat(x) for x in v]  # type: ignore[union-attr]
            except (ValueError, TypeError):
                raise HTTPException(422, "event_weeks must be a list of YYYY-MM-DD dates (week starts).")
        elif k not in DEFAULT_SETTINGS:
            raise HTTPException(422, f"Unknown setting: {k}")
        elif isinstance(v, list) or v < 0:
            raise HTTPException(422, f"Invalid value for {k}.")
        row = db.get(PlatformSetting, k)
        if row:
            row.value, row.updated_by = v, admin.id
        else:
            db.add(PlatformSetting(key=k, value=v, updated_by=admin.id))
    audit(db, admin, "settings.update", "settings", None, keys=sorted(body.values))
    db.commit()
    return get_settings(db)
