"""Request bodies. Server-side validation lives here (and in the services), never only in the frontend."""
import re
from datetime import datetime
from typing import Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, EmailStr, Field, field_validator

import email_validator

from app.config import settings
from app.models.base import CATEGORIES, Condition, ResourceStatus

# Development and tests use reserved demo domains such as demo.campus.test. The validator rejects those by
# default, so allow them everywhere except production, where real deliverable addresses are required.
if not settings.is_production:
    email_validator.TEST_ENVIRONMENT = True

Category = Literal[tuple(CATEGORIES)]  # type: ignore[valid-type]


class Strict(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class ChatIn(Strict):
    message: str = Field(min_length=1, max_length=500)


class RegisterIn(Strict):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    student_id: str = Field(min_length=3, max_length=40, pattern=r"^[A-Za-z0-9\-_/]+$")
    department: str = Field(min_length=2, max_length=120)
    college: str = Field(default="", max_length=160)
    password: str = Field(min_length=8, max_length=128)


class LoginIn(Strict):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class TokenIn(Strict):
    token: str = Field(min_length=10, max_length=200)


class ForgotIn(Strict):
    email: EmailStr


class ResetIn(Strict):
    token: str = Field(min_length=10, max_length=200)
    new_password: str = Field(min_length=8, max_length=128)


class ChangePasswordIn(Strict):
    current_password: str = Field(max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class ProfileUpdate(Strict):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    department: str | None = Field(default=None, min_length=2, max_length=120)
    college: str | None = Field(default=None, max_length=160)
    preferred_area: str | None = Field(default=None, max_length=120)
    open_to_activation: bool | None = None


class AvailabilityIn(Strict):
    start_at: AwareDatetime
    end_at: AwareDatetime

    @field_validator("end_at")
    @classmethod
    def _order(cls, v, info):
        if "start_at" in info.data and v <= info.data["start_at"]:
            raise ValueError("end_at must be after start_at")
        return v


class ResourceCreate(Strict):
    name: str = Field(min_length=3, max_length=140)
    category: Category
    description: str = Field(default="", max_length=2000)
    condition: Condition = Condition.good
    price_per_day: float = Field(default=0, ge=0, le=5000)
    deposit: float = Field(default=0, ge=0, le=50000)
    pickup_area: str = Field(default="", max_length=120)
    min_hours: int = Field(default=2, ge=1, le=168)
    max_days: int = Field(default=7, ge=1, le=60)
    availability: list[AvailabilityIn] = Field(default_factory=list, max_length=20)


class ResourceUpdate(Strict):
    name: str | None = Field(default=None, min_length=3, max_length=140)
    category: Category | None = None
    description: str | None = Field(default=None, max_length=2000)
    condition: Condition | None = None
    price_per_day: float | None = Field(default=None, ge=0, le=5000)
    deposit: float | None = Field(default=None, ge=0, le=50000)
    pickup_area: str | None = Field(default=None, max_length=120)
    min_hours: int | None = Field(default=None, ge=1, le=168)
    max_days: int | None = Field(default=None, ge=1, le=60)
    status: Literal["active", "inactive", "maintenance"] | None = None


class BookingIn(Strict):
    resource_id: int
    start_at: AwareDatetime
    end_at: AwareDatetime
    note: str = Field(default="", max_length=500)


class ReasonIn(Strict):
    reason: str = Field(default="", max_length=500)


class NotesIn(Strict):
    notes: str = Field(default="", max_length=1000)


class ReviewIn(Strict):
    rating: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=1000)


class ReportIn(Strict):
    description: str = Field(min_length=10, max_length=2000)


class ActivationAcceptIn(Strict):
    available_from: AwareDatetime
    available_until: AwareDatetime


class VerificationDecisionIn(Strict):
    approve: bool
    reason: str = Field(default="", max_length=500)


class UserAdminUpdate(Strict):
    account_status: Literal["active", "suspended"]
    reason: str = Field(default="", max_length=300)


class ModerationIn(Strict):
    action: Literal["remove", "restore"]
    note: str = Field(default="", max_length=500)


class ReportResolveIn(Strict):
    resolution: str = Field(min_length=3, max_length=1000)
    dismiss: bool = False
    deposit_outcome: Literal["release_deposit", "retain_deposit"] | None = None


class GenerateActivationIn(Strict):
    categories: list[Category] | None = None


class SettingsUpdate(Strict):
    values: dict[str, float | int | list[str]]
