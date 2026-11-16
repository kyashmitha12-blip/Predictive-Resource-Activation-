"""Turn ORM objects into the JSON the frontend receives. Never include hashes, tokens or private details."""
from datetime import datetime, timezone

from app.models import (ActivationRequest, Booking, BookingStatus, Resource, User)
from app.models.base import CATEGORY_LABELS


def f(x) -> float | None:
    return None if x is None else float(x)


def user_out(u: User) -> dict:
    return {"id": u.id, "email": u.email, "name": u.name, "student_id": u.student_id, "department": u.department,
            "college": u.college, "role": u.role.value, "account_status": u.account_status.value,
            "email_verified": u.email_verified_at is not None, "verification_status": u.verification_status.value,
            "verification_reason": u.verification_reason, "open_to_activation": u.open_to_activation,
            "preferred_area": u.preferred_area, "created_at": u.created_at, "is_demo": u.is_demo}


def public_user(u: User, stats: dict | None = None) -> dict:
    out = {"id": u.id, "name": u.name, "department": u.department, "verified": u.is_verified,
           "member_since": u.created_at}
    if stats is not None:
        out["stats"] = stats
    return out


def image_url(resource_id: int, image_id: int) -> str:
    return f"/api/resources/{resource_id}/images/{image_id}"


def resource_out(r: Resource, owner_stats: dict | None = None, detail: bool = False) -> dict:
    out = {
        "id": r.id, "name": r.name, "category": r.category, "category_label": CATEGORY_LABELS.get(r.category, r.category),
        "description": r.description, "condition": r.condition.value, "price_per_day": f(r.price_per_day),
        "deposit": f(r.deposit), "pickup_area": r.pickup_area, "min_hours": r.min_hours, "max_days": r.max_days,
        "status": r.status.value, "images": [{"id": i.id, "url": image_url(r.id, i.id)} for i in r.images],
        "owner": public_user(r.owner, owner_stats), "last_booked_at": r.last_booked_at, "created_at": r.created_at,
        "is_demo": r.is_demo, "moderation_note": r.moderation_note,
        "newly_activated": any(w.source == "activation" and w.end_at > datetime.now(timezone.utc) for w in r.availability),
    }
    now = datetime.now(timezone.utc)
    future = [w for w in r.availability if w.end_at > now]
    out["next_window"] = ({"start_at": min(future, key=lambda w: w.start_at).start_at,
                           "end_at": min(future, key=lambda w: w.start_at).end_at} if future else None)
    if detail:
        out["availability"] = [{"id": w.id, "start_at": w.start_at, "end_at": w.end_at, "source": w.source} for w in r.availability]
    return out


def _can(b: Booking, viewer: User, reviewed_by_viewer: bool) -> dict:
    owner, borrower = viewer.id == b.owner_id, viewer.id == b.borrower_id
    s = b.status
    return {
        "approve": owner and s == BookingStatus.requested, "reject": owner and s == BookingStatus.requested,
        "cancel": (owner or borrower) and s in (BookingStatus.requested, BookingStatus.confirmed),
        "handover": owner and s == BookingStatus.confirmed,
        "return": borrower and s == BookingStatus.active,
        "confirm_return": owner and s == BookingStatus.returned,
        "review": (owner or borrower) and s == BookingStatus.completed and not reviewed_by_viewer,
        "report": (owner or borrower) and s in (BookingStatus.active, BookingStatus.returned, BookingStatus.completed, BookingStatus.disputed),
    }


def booking_out(b: Booking, viewer: User, reviewed_by_viewer: bool = False, detail: bool = False) -> dict:
    r = b.resource
    out = {
        "id": b.id, "status": b.status.value, "start_at": b.start_at, "end_at": b.end_at, "note": b.note,
        "resource": {"id": r.id, "name": r.name, "category": r.category,
                     "category_label": CATEGORY_LABELS.get(r.category, r.category), "pickup_area": r.pickup_area,
                     "image_url": image_url(r.id, r.images[0].id) if r.images else None},
        "borrower": {"id": b.borrower.id, "name": b.borrower.name},
        "owner": {"id": b.owner.id, "name": b.owner.name},
        "rental_amount": f(b.rental_amount), "deposit_amount": f(b.deposit_amount),
        "payment_status": b.payment_status, "deposit_status": b.deposit_status,
        "payment_notice": "DEMO payment - no real money is charged or held.",
        "returned_at": b.returned_at, "completed_at": b.completed_at, "returned_on_time": b.returned_on_time,
        "late_cancellation": b.late_cancellation, "created_at": b.created_at, "is_demo": b.is_demo,
        "can": _can(b, viewer, reviewed_by_viewer),
    }
    if detail:
        out["history"] = [{"from_status": h.from_status, "to_status": h.to_status, "actor_id": h.actor_id,
                           "note": h.note, "created_at": h.created_at} for h in b.history]
        out["condition_reports"] = [{"id": c.id, "kind": c.kind.value, "reporter_id": c.reporter_id,
                                     "condition": c.condition, "notes": c.notes, "photo_count": len(c.photo_keys or []),
                                     "created_at": c.created_at} for c in b.condition_reports]
    return out


def activation_out(a: ActivationRequest) -> dict:
    r = a.resource
    return {"id": a.id, "status": a.status.value, "category": a.category,
            "category_label": CATEGORY_LABELS.get(a.category, a.category), "period_start": a.period_start,
            "period_end": a.period_end, "predicted_demand": a.predicted_demand, "supply_at_request": a.supply_at_request,
            "gap_at_request": a.gap_at_request, "reason": a.reason, "idle_score": a.idle_score,
            "score_breakdown": a.score_breakdown, "available_from": a.available_from, "available_until": a.available_until,
            "decline_reason": a.decline_reason, "created_at": a.created_at, "responded_at": a.responded_at,
            "is_demo": a.is_demo,
            "resource": {"id": r.id, "name": r.name, "min_hours": r.min_hours, "condition": r.condition.value,
                         "image_url": image_url(r.id, r.images[0].id) if r.images else None}}


def page(items: list, total: int, page_no: int, size: int) -> dict:
    return {"items": items, "total": total, "page": page_no, "page_size": size,
            "pages": max(1, -(-total // size))}
