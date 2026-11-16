"""Transparent, configurable idle-resource detection and activation candidate ranking.

A resource is an *activation candidate* for a category/period when ALL hard rules hold:
  - status is active/inactive, condition is not 'worn', owner is active + verified + open to suggestions
  - it is not already part of effective supply for the period (not offered / fully booked)
  - no confirmed/active booking overlaps the period
  - no pending or accepted activation request already covers the period
  - the owner has not hit the weekly request cap
It is flagged *idle* if days since last use >= idle_days_threshold OR utilization < utilization_threshold.
Activation score (0..1) = 0.40 recency + 0.30 low utilization + 0.15 condition + 0.15 owner reliability.
"""
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models import (AccountStatus, ActivationRequest, ActivationStatus, Booking, BookingStatus, Condition,
                        Resource, ResourceStatus, User, VerificationStatus)
from app.services.availability import BLOCKING
from app.services.core import get_settings_map
from app.services.reliability import user_stats
from app.services.supply import effective_supply, period_bounds

USED = (BookingStatus.completed, BookingStatus.active, BookingStatus.returned, BookingStatus.disputed)
CONDITION_SCORE = {Condition.new: 1.0, Condition.good: 0.85, Condition.fair: 0.6, Condition.worn: 0.0}


def utilization(db: Session, resource_id: int, window_days: int, now: datetime) -> float:
    start = now - timedelta(days=window_days)
    days: set[date] = set()
    for b in db.scalars(select(Booking).where(Booking.resource_id == resource_id, Booking.status.in_(USED),
                                              Booking.end_at > start, Booking.start_at < now)):
        d = max(b.start_at, start).date()
        last = min(b.end_at, now).date()
        while d <= last:
            days.add(d)
            d += timedelta(days=1)
    return round(min(1.0, len(days) / window_days), 3)


def idle_metrics(db: Session, r: Resource, cfg: dict, now: datetime) -> dict:
    last = r.last_booked_at or db.scalar(select(func.max(Booking.end_at)).where(Booking.resource_id == r.id, Booking.status.in_(USED)))
    reference = last or r.created_at
    days_since = max(0, (now - reference).days)
    util = utilization(db, r.id, int(cfg["utilization_window_days"]), now)
    idle = days_since >= cfg["idle_days_threshold"] or util < cfg["utilization_threshold"]
    return {"days_since_last_use": days_since, "never_booked": last is None, "utilization": util, "is_idle": idle}


def _score(m: dict, r: Resource, reliability: float) -> tuple[float, dict]:
    recency = min(1.0, m["days_since_last_use"] / 60)
    low_util = 1 - min(1.0, m["utilization"] / 0.5)
    cond = CONDITION_SCORE[r.condition]
    parts = {"recency": round(0.40 * recency, 3), "low_utilization": round(0.30 * low_util, 3),
             "condition": round(0.15 * cond, 3), "owner_reliability": round(0.15 * reliability, 3)}
    return round(sum(parts.values()), 3), parts


def opportunity_label(score: float) -> str:
    return "High" if score >= 0.65 else "Medium" if score >= 0.4 else "Low"


def candidates(db: Session, category: str, period_start: date, period_end: date,
               supply: dict | None = None, now: datetime | None = None) -> list[dict]:
    now = now or datetime.now(timezone.utc)
    cfg = get_settings_map(db)
    start, end = period_bounds(period_start, period_end)
    supply = supply or effective_supply(db, period_start, period_end)
    offered = set(supply.get(category, {}).get("resource_ids", []))
    busy = set(db.scalars(select(Booking.resource_id).where(Booking.status.in_(BLOCKING), Booking.start_at < end, Booking.end_at > start)))
    asked = set(db.scalars(select(ActivationRequest.resource_id).where(
        ActivationRequest.status.in_((ActivationStatus.pending, ActivationStatus.accepted)),
        ActivationRequest.period_start <= period_end, ActivationRequest.period_end >= period_start)))
    week_ago = now - timedelta(days=7)
    caps = dict(db.execute(select(ActivationRequest.owner_id, func.count()).where(ActivationRequest.created_at > week_ago)
                           .group_by(ActivationRequest.owner_id)).all())
    rows = db.scalars(select(Resource).where(
        Resource.category == category, Resource.status.in_((ResourceStatus.active, ResourceStatus.inactive)),
        Resource.condition != Condition.worn).options(joinedload(Resource.owner))).unique()
    out = []
    for r in rows:
        o = r.owner
        if (o.account_status != AccountStatus.active or o.verification_status != VerificationStatus.approved
                or not o.open_to_activation):
            continue
        if r.id in offered or r.id in busy or r.id in asked:
            continue
        if caps.get(o.id, 0) >= cfg["max_requests_per_owner_per_week"]:
            continue
        m = idle_metrics(db, r, cfg, now)
        if not m["is_idle"]:
            continue
        rel = user_stats(db, o.id)["reliability"]
        score, parts = _score(m, r, rel)
        out.append({"resource": r, "owner": o, "metrics": m, "score": score, "score_breakdown": parts,
                    "opportunity": opportunity_label(score), "owner_reliability": rel})
    out.sort(key=lambda c: -c["score"])
    return out
