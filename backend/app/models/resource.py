from datetime import datetime
from decimal import Decimal

from sqlalchemy import (Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, Numeric, String,
                        Text, func)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, Condition, ResourceStatus, TimestampMixin, enum_col, utcnow
from app.models.user import User


class Resource(Base, TimestampMixin):
    __tablename__ = "resources"
    __table_args__ = (
        CheckConstraint("price_per_day >= 0", name="price_non_negative"),
        CheckConstraint("deposit >= 0", name="deposit_non_negative"),
        CheckConstraint("min_hours >= 1 AND max_days >= 1", name="duration_limits"),
        Index("ix_resources_category_status", "category", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(140))
    category: Mapped[str] = mapped_column(String(40), index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    condition: Mapped[Condition] = mapped_column(enum_col(Condition), default=Condition.good)
    price_per_day: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=0)  # 0 = free sharing
    deposit: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=0)
    pickup_area: Mapped[str] = mapped_column(String(120), default="")  # general area only, never a home address
    min_hours: Mapped[int] = mapped_column(Integer, default=2)
    max_days: Mapped[int] = mapped_column(Integer, default=7)
    status: Mapped[ResourceStatus] = mapped_column(enum_col(ResourceStatus), default=ResourceStatus.active)
    moderation_note: Mapped[str | None] = mapped_column(Text)
    last_booked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # last completed/active use
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)

    owner: Mapped[User] = relationship()
    images: Mapped[list["ResourceImage"]] = relationship(
        back_populates="resource", cascade="all, delete-orphan", order_by="ResourceImage.position"
    )
    availability: Mapped[list["ResourceAvailability"]] = relationship(
        back_populates="resource", cascade="all, delete-orphan", order_by="ResourceAvailability.start_at"
    )


class ResourceImage(Base):
    __tablename__ = "resource_images"

    id: Mapped[int] = mapped_column(primary_key=True)
    resource_id: Mapped[int] = mapped_column(ForeignKey("resources.id", ondelete="CASCADE"), index=True)
    storage_key: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(60))
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=utcnow)

    resource: Mapped[Resource] = relationship(back_populates="images")


class ResourceAvailability(Base):
    """A window in which the owner offers the resource. `source` records whether the owner added it
    directly or it came from accepting a predictive activation request."""
    __tablename__ = "resource_availability"
    __table_args__ = (CheckConstraint("end_at > start_at", name="window_order"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    resource_id: Mapped[int] = mapped_column(ForeignKey("resources.id", ondelete="CASCADE"), index=True)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    source: Mapped[str] = mapped_column(String(20), default="owner")  # owner | activation
    activation_request_id: Mapped[int | None] = mapped_column(ForeignKey("activation_requests.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=utcnow)

    resource: Mapped[Resource] = relationship(back_populates="availability")
