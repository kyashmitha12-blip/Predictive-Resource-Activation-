import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, MetaData, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

NAMING = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def enum_col(cls: type[enum.Enum]):
    """Store enums as validated VARCHAR + CHECK constraint (easy to migrate, readable in SQL)."""
    return SAEnum(
        cls, native_enum=False, length=24, create_constraint=True, validate_strings=True,
        values_callable=lambda e: [m.value for m in e], name=cls.__name__.lower(),
    )


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=utcnow, onupdate=utcnow
    )


class Role(str, enum.Enum):
    student = "student"
    admin = "admin"


class AccountStatus(str, enum.Enum):
    active = "active"
    suspended = "suspended"


class VerificationStatus(str, enum.Enum):
    not_submitted = "not_submitted"
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class ResourceStatus(str, enum.Enum):
    active = "active"            # listed and bookable inside its availability windows
    inactive = "inactive"        # owner is not sharing it right now (idle candidates live here)
    maintenance = "maintenance"
    archived = "archived"        # owner removed it
    removed = "removed"          # removed by moderation


class Condition(str, enum.Enum):
    new = "new"
    good = "good"
    fair = "fair"
    worn = "worn"


class BookingStatus(str, enum.Enum):
    requested = "requested"
    confirmed = "confirmed"
    active = "active"        # handed over
    returned = "returned"    # borrower says it is back, owner has not yet confirmed
    completed = "completed"
    rejected = "rejected"
    cancelled = "cancelled"
    disputed = "disputed"


class ActivationStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    declined = "declined"
    withdrawn = "withdrawn"
    expired = "expired"


class ReportKind(str, enum.Enum):
    complaint = "complaint"
    damage = "damage"
    dispute = "dispute"


class ReportStatus(str, enum.Enum):
    open = "open"
    resolved = "resolved"
    dismissed = "dismissed"


class ConditionReportKind(str, enum.Enum):
    handover = "handover"
    returned = "return"


CATEGORIES = [
    "projector", "camera", "audio", "electronics_kit",
    "laptop", "lab_equipment", "tool", "event_equipment",
]
CATEGORY_LABELS = {
    "projector": "Projectors", "camera": "Cameras & tripods", "audio": "Audio equipment",
    "electronics_kit": "Arduino & electronics kits", "laptop": "Laptops & accessories",
    "lab_equipment": "Lab equipment", "tool": "Tools", "event_equipment": "Event equipment",
}
