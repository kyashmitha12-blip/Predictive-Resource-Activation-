from datetime import datetime
from decimal import Decimal

from sqlalchemy import (Boolean, CheckConstraint, DateTime, ForeignKey, Integer, Numeric, String, Text, func,
                        text)
from sqlalchemy.dialects.postgresql import ExcludeConstraint, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import (Base, BookingStatus, ConditionReportKind, TimestampMixin, enum_col, utcnow)
from app.models.resource import Resource
from app.models.user import User


class Booking(Base, TimestampMixin):
    __tablename__ = "bookings"
    __table_args__ = (
        CheckConstraint("end_at > start_at", name="period_order"),
        CheckConstraint("borrower_id <> owner_id", name="no_self_booking"),
        # Database-level double-booking guard: two confirmed/active bookings for the same resource
        # may never overlap, even under concurrent requests. Needs the btree_gist extension.
        ExcludeConstraint(
            ("resource_id", "="),
            (func.tstzrange(text("start_at"), text("end_at"), "[)"), "&&"),
            where=text("status IN ('confirmed','active')"),
            using="gist",
            name="ex_bookings_no_overlap",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    resource_id: Mapped[int] = mapped_column(ForeignKey("resources.id", ondelete="CASCADE"), index=True)
    borrower_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[BookingStatus] = mapped_column(enum_col(BookingStatus), default=BookingStatus.requested, index=True)
    note: Mapped[str] = mapped_column(Text, default="")
    rental_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    deposit_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    # Payments are DEMO only: no real money moves and no card data is stored.
    payment_status: Mapped[str] = mapped_column(String(20), default="demo_pending")  # demo_pending|demo_paid|demo_refunded|not_required
    deposit_status: Mapped[str] = mapped_column(String(20), default="none")  # none|demo_held|demo_released|demo_retained
    returned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    returned_on_time: Mapped[bool | None] = mapped_column(Boolean)
    late_cancellation: Mapped[bool] = mapped_column(Boolean, default=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)  # seeded sample record

    resource: Mapped[Resource] = relationship()
    borrower: Mapped[User] = relationship(foreign_keys=[borrower_id])
    owner: Mapped[User] = relationship(foreign_keys=[owner_id])
    history: Mapped[list["BookingStatusHistory"]] = relationship(
        back_populates="booking", cascade="all, delete-orphan", order_by="BookingStatusHistory.id"
    )
    condition_reports: Mapped[list["ConditionReport"]] = relationship(
        back_populates="booking", cascade="all, delete-orphan", order_by="ConditionReport.id"
    )


class BookingStatusHistory(Base):
    __tablename__ = "booking_status_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id", ondelete="CASCADE"), index=True)
    from_status: Mapped[str | None] = mapped_column(String(24))
    to_status: Mapped[str] = mapped_column(String(24))
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=utcnow)

    booking: Mapped[Booking] = relationship(back_populates="history")


class ConditionReport(Base):
    __tablename__ = "condition_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id", ondelete="CASCADE"), index=True)
    kind: Mapped[ConditionReportKind] = mapped_column(enum_col(ConditionReportKind))
    reporter_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    condition: Mapped[str] = mapped_column(String(20))  # as_expected | minor_wear | damaged
    notes: Mapped[str] = mapped_column(Text, default="")
    photo_keys: Mapped[list] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=utcnow)

    booking: Mapped[Booking] = relationship(back_populates="condition_reports")
