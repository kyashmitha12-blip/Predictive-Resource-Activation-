from datetime import date, datetime

from sqlalchemy import (Boolean, CheckConstraint, Date, DateTime, Float, ForeignKey, Index, Integer, String,
                        Text, UniqueConstraint, func)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import ActivationStatus, Base, enum_col, utcnow
from app.models.resource import Resource
from app.models.user import User


class DemandHistory(Base):
    """Weekly booking counts per category. `source` separates real bookings from synthetic demo history."""
    __tablename__ = "demand_history"
    __table_args__ = (UniqueConstraint("category", "week_start", "source", name="uq_demand_history_week"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    category: Mapped[str] = mapped_column(String(40), index=True)
    week_start: Mapped[date] = mapped_column(Date)
    bookings: Mapped[int] = mapped_column(Integer)
    event_flag: Mapped[bool] = mapped_column(Boolean, default=False)  # exam / fest / hackathon week
    source: Mapped[str] = mapped_column(String(12))  # real | synthetic


class DemandForecast(Base):
    __tablename__ = "demand_forecasts"

    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[str] = mapped_column(String(36), index=True)
    category: Mapped[str] = mapped_column(String(40))
    period_start: Mapped[date] = mapped_column(Date)
    period_end: Mapped[date] = mapped_column(Date)
    predicted_demand: Mapped[float] = mapped_column(Float)
    lower: Mapped[float] = mapped_column(Float)
    upper: Mapped[float] = mapped_column(Float)
    effective_supply: Mapped[int] = mapped_column(Integer)  # supply at the moment the forecast ran
    supply_gap: Mapped[int] = mapped_column(Integer)
    demand_level: Mapped[str] = mapped_column(String(12))
    model_name: Mapped[str] = mapped_column(String(40))
    model_version: Mapped[str] = mapped_column(String(60))
    data_basis: Mapped[str] = mapped_column(String(20))  # synthetic_only | mixed | real_only
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=utcnow)


class PredictionEvaluation(Base):
    __tablename__ = "prediction_evaluations"

    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[str] = mapped_column(String(36), index=True)
    model_version: Mapped[str] = mapped_column(String(60))
    model_name: Mapped[str] = mapped_column(String(40))
    is_selected: Mapped[bool] = mapped_column(Boolean, default=False)
    mae: Mapped[float] = mapped_column(Float)
    rmse: Mapped[float] = mapped_column(Float)
    n_train: Mapped[int] = mapped_column(Integer)
    n_test: Mapped[int] = mapped_column(Integer)
    n_real_weeks: Mapped[int] = mapped_column(Integer)
    n_synthetic_weeks: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=utcnow)


class ActivationRequest(Base):
    """A consent-based suggestion asking an owner to make an idle resource available."""
    __tablename__ = "activation_requests"
    __table_args__ = (
        UniqueConstraint("resource_id", "run_id", name="uq_activation_resource_run"),  # no duplicate asks per forecast
        Index("ix_activation_owner_status", "owner_id", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[str] = mapped_column(String(36))
    resource_id: Mapped[int] = mapped_column(ForeignKey("resources.id", ondelete="CASCADE"), index=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    category: Mapped[str] = mapped_column(String(40))
    period_start: Mapped[date] = mapped_column(Date)
    period_end: Mapped[date] = mapped_column(Date)
    predicted_demand: Mapped[float] = mapped_column(Float)
    supply_at_request: Mapped[int] = mapped_column(Integer)
    gap_at_request: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(Text)
    idle_score: Mapped[float] = mapped_column(Float)
    score_breakdown: Mapped[dict] = mapped_column(JSONB, default=dict)
    status: Mapped[ActivationStatus] = mapped_column(enum_col(ActivationStatus), default=ActivationStatus.pending)
    available_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    available_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decline_reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=utcnow)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)

    resource: Mapped[Resource] = relationship()
    owner: Mapped[User] = relationship()


class PlatformSetting(Base):
    __tablename__ = "platform_settings"

    key: Mapped[str] = mapped_column(String(60), primary_key=True)
    value: Mapped[dict | list | int | float | str | bool | None] = mapped_column(JSONB)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=utcnow, onupdate=utcnow)
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
