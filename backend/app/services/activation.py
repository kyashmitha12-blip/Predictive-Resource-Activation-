"""Consent-based owner activation: suggest, ask, and only act on an explicit owner decision."""
import math
from datetime import date, datetime, time, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (ActivationRequest, ActivationStatus, Booking, BookingStatus, DemandForecast, Resource,
                        ResourceAvailability, ResourceStatus, User)
from app.models.base import CATEGORY_LABELS
from app.services import forecast_service
from app.services.availability import BLOCKING
from app.services.bookings import _move
from app.services.core import audit, get_settings_map, notify, notify_admins
from app.services.idle import candidates
from app.services.supply import demand_level, effective_supply, period_bounds, supply_gap


def expire_stale(db: Session) -> None:
    today = datetime.now(timezone.utc).date()
    for r in db.scalars(select(ActivationRequest).where(ActivationRequest.status == ActivationStatus.pending,
                                                        ActivationRequest.period_end < today)):
        r.status = ActivationStatus.expired
    db.flush()


def generate_requests(db: Session, actor: User | None, run_id: str | None = None,
                      categories: list[str] | None = None) -> dict:
    """For each category with a live supply gap, ask the best-ranked idle owners (never auto-activate)."""
    run_id = run_id or forecast_service.latest_run_id(db)
    if not run_id:
        raise HTTPException(409, "Run a demand forecast first.")
    expire_stale(db)
    cfg = get_settings_map(db)
    forecasts = list(db.scalars(select(DemandForecast).where(DemandForecast.run_id == run_id)))
    out = {"run_id": run_id, "categories": [], "created": 0}
    # Owners already asked in the last 7 days (enforced across categories inside this run too)
    owner_counts = dict(db.execute(select(ActivationRequest.owner_id, func.count()).where(
        ActivationRequest.created_at > datetime.now(timezone.utc) - timedelta(days=7)).group_by(ActivationRequest.owner_id)).all())
    for f in forecasts:
        if categories and f.category not in categories:
            continue
        supply = effective_supply(db, f.period_start, f.period_end)
        sup = supply.get(f.category, {}).get("effective", 0)
        gap = supply_gap(f.predicted_demand, sup)
        entry = {"category": f.category, "gap": gap, "supply": sup, "asked": 0, "candidates": 0}
        if gap > 0:
            cands = candidates(db, f.category, f.period_start, f.period_end, supply)
            entry["candidates"] = len(cands)
            to_ask = min(len(cands), math.ceil(gap * cfg["overask_factor"]))
            label = CATEGORY_LABELS.get(f.category, f.category).lower()
            picked = []
            for c in cands:
                if len(picked) >= to_ask:
                    break
                if owner_counts.get(c["owner"].id, 0) >= cfg["max_requests_per_owner_per_week"]:
                    continue
                owner_counts[c["owner"].id] = owner_counts.get(c["owner"].id, 0) + 1
                picked.append(c)
            for c in picked:
                r, m = c["resource"], c["metrics"]
                used = ("has never been booked" if m["never_booked"] else f"was last used {m['days_since_last_use']} days ago")
                reason = (f"High {label} demand is predicted for {f.period_start:%d %b}-{f.period_end:%d %b}: about "
                          f"{round(f.predicted_demand)} requests against {sup} available (a gap of {gap}). "
                          f"Your {r.name} {used} and was booked on {round(m['utilization'] * 100)}% of the last "
                          f"{int(cfg['utilization_window_days'])} days. You choose whether to share it and for which dates.")
                req = ActivationRequest(
                    run_id=run_id, resource_id=r.id, owner_id=r.owner_id, category=f.category,
                    period_start=f.period_start, period_end=f.period_end, predicted_demand=f.predicted_demand,
                    supply_at_request=sup, gap_at_request=gap, reason=reason, idle_score=c["score"],
                    score_breakdown={**c["score_breakdown"], **m}, status=ActivationStatus.pending)
                db.add(req)
                db.flush()
                notify(db, r.owner_id, "activation_request", f"Your {r.name} could help meet predicted demand",
                       reason, f"/app/activation/{req.id}", dedupe_key=f"activation:{r.id}:{run_id}")
                entry["asked"] += 1
                out["created"] += 1
        out["categories"].append(entry)
    audit(db, actor, "activation.generate", "forecast", None, run_id=run_id, created=out["created"])
    db.commit()
    return out


def _owned(db: Session, req_id: int, owner: User) -> ActivationRequest:
    req = db.get(ActivationRequest, req_id)
    if not req or req.owner_id != owner.id:
        raise HTTPException(404, "Activation request not found.")
    return req


def accept(db: Session, req_id: int, owner: User, available_from: datetime, available_until: datetime) -> ActivationRequest:
    req = _owned(db, req_id, owner)
    if req.status != ActivationStatus.pending:
        raise HTTPException(409, f"This request is already {req.status.value}.")
    lo, hi = period_bounds(req.period_start, req.period_end)
    if available_until <= available_from:
        raise HTTPException(422, "The end of the availability period must be after its start.")
    if available_from < lo or available_until > hi:
        raise HTTPException(422, f"Choose dates inside the requested period ({req.period_start} to {req.period_end}).")
    r = db.get(Resource, req.resource_id)
    if r.status in (ResourceStatus.archived, ResourceStatus.removed):
        raise HTTPException(409, "This resource is no longer listed.")
    if (available_until - available_from) < timedelta(hours=r.min_hours):
        raise HTTPException(422, f"The period must be at least {r.min_hours} hours (the resource's minimum booking).")
    db.add(ResourceAvailability(resource_id=r.id, start_at=available_from, end_at=available_until,
                                source="activation", activation_request_id=req.id))
    r.status = ResourceStatus.active
    req.status, req.available_from, req.available_until = ActivationStatus.accepted, available_from, available_until
    req.responded_at = datetime.now(timezone.utc)
    audit(db, owner, "activation.accept", "activation_request", req.id, resource_id=r.id)
    notify(db, owner.id, "activation_accepted", f"{r.name} is now available",
           f"Shared {available_from:%d %b %H:%M} to {available_until:%d %b %H:%M}. You can withdraw until a booking is confirmed.",
           f"/app/resources/{r.id}")
    notify_admins(db, "activation_accepted", "An owner accepted an activation request",
                  f"{r.name} ({req.category.replace('_', ' ')})", "/admin/activation")
    db.commit()
    return req


def decline(db: Session, req_id: int, owner: User, reason: str = "") -> ActivationRequest:
    req = _owned(db, req_id, owner)
    if req.status != ActivationStatus.pending:
        raise HTTPException(409, f"This request is already {req.status.value}.")
    req.status, req.decline_reason, req.responded_at = ActivationStatus.declined, reason, datetime.now(timezone.utc)
    audit(db, owner, "activation.decline", "activation_request", req.id)
    notify_admins(db, "activation_declined", "An owner declined an activation request",
                  f"{req.resource.name}: {reason or 'no reason given'}", "/admin/activation")
    db.commit()
    return req


def withdraw(db: Session, req_id: int, owner: User) -> ActivationRequest:
    req = _owned(db, req_id, owner)
    if req.status != ActivationStatus.accepted:
        raise HTTPException(409, "Only an accepted activation can be withdrawn.")
    win = db.scalars(select(ResourceAvailability).where(ResourceAvailability.activation_request_id == req.id)).all()
    for w in win:
        if db.scalar(select(Booking.id).where(Booking.resource_id == req.resource_id, Booking.status.in_(BLOCKING),
                                              Booking.start_at < w.end_at, Booking.end_at > w.start_at)):
            raise HTTPException(409, "A booking is already confirmed in this period, so it can no longer be withdrawn.")
    for w in win:
        for b in db.scalars(select(Booking).where(Booking.resource_id == req.resource_id, Booking.status == BookingStatus.requested,
                                                  Booking.start_at < w.end_at, Booking.end_at > w.start_at)):
            _move(db, b, BookingStatus.rejected, owner, "Owner withdrew availability")
            notify(db, b.borrower_id, "booking_rejected", "A booking request was withdrawn",
                   "The owner is no longer sharing this resource for that period.", f"/app/bookings/{b.id}")
        db.delete(w)
    req.status = ActivationStatus.withdrawn
    audit(db, owner, "activation.withdraw", "activation_request", req.id)
    db.commit()
    return req
