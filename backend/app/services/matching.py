"""Explainable smart matching. Only resources that pass the availability check are ever returned.

score = 0.25*price + 0.20*condition + 0.25*owner_reliability + 0.20*location + 0.10*keyword_fit
  price        : with a budget, 1.0 at <=70% of it falling to 0.5 at the budget (over budget = excluded);
                 without a budget, cheaper relative to the other matches scores higher
  condition    : new 1.0, good 0.85, fair 0.6, worn 0.35
  reliability  : smoothed owner reliability (reviews, on-time returns, late cancellations)
  location     : same pickup area 1.0, different 0.4, no preference 0.7 (neutral)
  keyword_fit  : share of requested keywords found in name/description, no keywords 0.7 (neutral)
"""
import re
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models import Condition, Resource, ResourceStatus
from app.models.base import CATEGORY_LABELS
from app.services.availability import check_availability, rental_amount
from app.services.reliability import user_stats

COND = {Condition.new: 1.0, Condition.good: 0.85, Condition.fair: 0.6, Condition.worn: 0.35}
WEIGHTS = {"price": 0.25, "condition": 0.20, "reliability": 0.25, "location": 0.20, "keywords": 0.10}


def match(db: Session, start: datetime, end: datetime, category: str | None = None, max_price_per_day: float | None = None,
          area: str | None = None, keywords: str | None = None, exclude_owner_id: int | None = None, limit: int = 12) -> dict:
    q = select(Resource).where(Resource.status == ResourceStatus.active).options(
        joinedload(Resource.owner), selectinload(Resource.availability), selectinload(Resource.images))
    if category:
        q = q.where(Resource.category == category)
    if exclude_owner_id:
        q = q.where(Resource.owner_id != exclude_owner_id)
    pool = list(db.scalars(q).unique())
    bookable, excluded_unavailable, excluded_budget = [], 0, 0
    for r in pool:
        if check_availability(db, r, start, end):
            excluded_unavailable += 1
            continue
        if max_price_per_day is not None and float(r.price_per_day) > max_price_per_day:
            excluded_budget += 1
            continue
        bookable.append(r)
    tokens = [t for t in re.split(r"\W+", (keywords or "").lower()) if len(t) > 1]
    top_price = max([float(r.price_per_day) for r in bookable] + [1.0])
    results = []
    for r in bookable:
        price = float(r.price_per_day)
        reasons = ["Available for your whole period"]
        if max_price_per_day:
            p = 1.0 if price <= 0.7 * max_price_per_day else 0.5 + 0.5 * (max_price_per_day - price) / (0.3 * max_price_per_day)
            reasons.append("Free to borrow" if price == 0 else "Within your budget")
        else:
            p = 1 - 0.6 * price / top_price
            if price == 0:
                reasons.append("Free to borrow")
        c = COND[r.condition]
        reasons.append(f"Condition: {r.condition.value}")
        stats = user_stats(db, r.owner_id)
        rel = stats["reliability"]
        if stats["average_rating"] is not None:
            reasons.append(f"Owner rated {stats['average_rating']}/5 ({stats['review_count']} reviews)")
        else:
            reasons.append("Owner has no reviews yet")
        if area:
            same = area.strip().lower() in r.pickup_area.lower() or r.pickup_area.lower() in area.strip().lower()
            loc = 1.0 if (same and r.pickup_area) else 0.4
            reasons.append("Pickup in your preferred area" if loc == 1.0 else f"Pickup at {r.pickup_area or 'an unspecified area'}")
        else:
            loc = 0.7
        if tokens:
            text = f"{r.name} {r.description}".lower()
            hits = [t for t in tokens if t in text]
            kw = len(hits) / len(tokens)
            if hits:
                reasons.append("Matches: " + ", ".join(hits))
        else:
            kw = 0.7
        parts = {"price": p, "condition": c, "reliability": rel, "location": loc, "keywords": kw}
        score = sum(WEIGHTS[k] * v for k, v in parts.items())
        activated = any(w.source == "activation" for w in r.availability)
        if activated:
            reasons.append("Newly made available after a predicted shortage")
        results.append({"resource": r, "score": round(score * 100), "reasons": reasons,
                        "components": {k: round(v, 2) for k, v in parts.items()},
                        "estimated_cost": float(rental_amount(r, start, end)), "deposit": float(r.deposit),
                        "newly_activated": activated, "owner_stats": stats})
    results.sort(key=lambda x: -x["score"])
    return {"matches": results[:limit], "considered": len(pool), "excluded_unavailable": excluded_unavailable,
            "excluded_over_budget": excluded_budget, "weights": WEIGHTS}
