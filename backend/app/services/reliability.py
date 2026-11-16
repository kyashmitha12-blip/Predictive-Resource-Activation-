"""Reliability indicators computed from recorded bookings and reviews (not an ML prediction)."""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Booking, BookingStatus, Review


def user_stats(db: Session, user_id: int) -> dict:
    completed_owner = db.scalar(select(func.count()).where(Booking.owner_id == user_id, Booking.status == BookingStatus.completed)) or 0
    completed_borrower = db.scalar(select(func.count()).where(Booking.borrower_id == user_id, Booking.status == BookingStatus.completed)) or 0
    returns = db.execute(
        select(func.count(), func.count().filter(Booking.returned_on_time.is_(True)))
        .where(Booking.borrower_id == user_id, Booking.returned_on_time.is_not(None))
    ).one()
    avg, n = db.execute(select(func.avg(Review.rating), func.count()).where(Review.reviewee_id == user_id)).one()
    late_cancel = db.scalar(select(func.count()).where(Booking.late_cancellation.is_(True),
                                                       (Booking.owner_id == user_id) | (Booking.borrower_id == user_id))) or 0
    on_time_rate = round(returns[1] / returns[0], 3) if returns[0] else None
    avg_rating = round(float(avg), 2) if avg is not None else None
    # Smoothed 0..1 reliability used by matching/idle ranking: few reviews => pulled toward a neutral 0.7
    prior, weight = 0.7, 3
    rating_part = ((avg_rating / 5) * n + prior * weight) / (n + weight) if avg_rating is not None else prior
    punctual_part = on_time_rate if on_time_rate is not None else prior
    reliability = round(0.6 * rating_part + 0.4 * punctual_part - min(0.2, 0.05 * late_cancel), 3)
    return {
        "completed_as_owner": completed_owner,
        "completed_as_borrower": completed_borrower,
        "completed_rentals": completed_owner + completed_borrower,
        "on_time_return_rate": on_time_rate,
        "average_rating": avg_rating,
        "review_count": n,
        "late_cancellations": late_cancel,
        "reliability": max(0.0, min(1.0, reliability)),
    }
