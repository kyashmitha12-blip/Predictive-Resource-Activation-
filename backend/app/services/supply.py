"""Effective supply and supply-gap calculation.

Total listed  = resources with status 'active'.
Effective supply for a period = distinct resources that
  - are active, owned by an active + admin-verified student,
  - are offered by the owner (an availability window overlaps the period), and
  - still have at least `min_hours` of free time in the period after confirmed/active bookings.
Each resource is counted once, however many windows it has. Predicted demand is never mixed into this number.
"""
from datetime import date, datetime, time, timezone, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models import (AccountStatus, Booking, Resource, ResourceStatus, User, VerificationStatus)
from app.services.availability import BLOCKING, merged_windows
from app.services.core import get_settings_map


def period_bounds(period_start: date, period_end: date) -> tuple[datetime, datetime]:
    return (datetime.combine(period_start, time.min, tzinfo=timezone.utc),
            datetime.combine(period_end + timedelta(days=1), time.min, tzinfo=timezone.utc))


def _owner_ok(u: User) -> bool:
    return u.account_status == AccountStatus.active and u.verification_status == VerificationStatus.approved


def free_hours(resource: Resource, start: datetime, end: datetime, bookings: list[Booking]) -> float:
    free = 0.0
    busy = sorted((max(b.start_at, start), min(b.end_at, end)) for b in bookings)
    for ws, we in merged_windows(resource.availability):
        s, e = max(ws, start), min(we, end)
        if e <= s:
            continue
        cursor = s
        for bs, be in busy:
            if be <= cursor or bs >= e:
                continue
            if bs > cursor:
                free += (bs - cursor).total_seconds() / 3600
            cursor = max(cursor, be)
        if cursor < e:
            free += (e - cursor).total_seconds() / 3600
    return free


def effective_supply(db: Session, period_start: date, period_end: date) -> dict[str, dict]:
    start, end = period_bounds(period_start, period_end)
    resources = list(db.scalars(
        select(Resource).where(Resource.status == ResourceStatus.active)
        .options(joinedload(Resource.owner), selectinload(Resource.availability))).unique())
    booked: dict[int, list[Booking]] = {}
    for b in db.scalars(select(Booking).where(Booking.status.in_(BLOCKING), Booking.start_at < end, Booking.end_at > start)):
        booked.setdefault(b.resource_id, []).append(b)
    units = int(get_settings_map(db)["units_per_resource"])
    out: dict[str, dict] = {}
    for r in resources:
        row = out.setdefault(r.category, {"listed": 0, "resource_ids": [], "unavailable": []})
        row["listed"] += 1
        if _owner_ok(r.owner) and free_hours(r, start, end, booked.get(r.id, [])) >= r.min_hours:
            row["resource_ids"].append(r.id)
        else:
            row["unavailable"].append(r.id)
    for row in out.values():
        row["effective"] = len(row["resource_ids"]) * units
    return out


def demand_level(predicted: float, supply: int) -> str:
    if predicted <= 0:
        return "low"
    if supply <= 0:
        return "critical"
    ratio = predicted / supply
    return "low" if ratio < 0.7 else "moderate" if ratio < 1.0 else "high" if ratio < 1.5 else "critical"


def supply_gap(predicted: float, supply: int) -> int:
    return max(0, round(predicted) - supply)
