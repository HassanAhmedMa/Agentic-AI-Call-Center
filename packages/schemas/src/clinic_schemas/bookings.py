from datetime import date, datetime
from typing import Literal

from pydantic import Field, field_validator

from clinic_schemas.availability import AvailabilityQuery
from clinic_schemas.catalog import DTO, MAX_CATALOG_ID, Specialty


class Slot(DTO):
    date: date
    start_time: str = Field(pattern=r"^(?:[01][0-9]|2[0-3]):[0-5][0-9]$")

    @field_validator("date", mode="before")
    @classmethod
    def calendar_date(cls, value: object) -> object:
        return AvailabilityQuery.strict_date(value)


class Book(Slot):
    doctor_id: int = Field(gt=0, le=MAX_CATALOG_ID)
    visit_reason: str | None = Field(
        default=None, max_length=300, pattern=r"^[^\x00-\x1f]*$"
    )


class Cancel(DTO):
    reason: str | None = Field(default=None, max_length=300, pattern=r"^[^\x00-\x1f]*$")


class AppointmentQuery(DTO):
    status: Literal["scheduled", "completed", "cancelled", "no_show", "all"] = (
        "scheduled"
    )
    upcoming_only: bool | None = None
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0, le=MAX_CATALOG_ID)


class AppointmentDoctor(DTO):
    id: int
    name_en: str
    name_ar: str
    specialty: Specialty


class Appointment(DTO):
    id: int
    doctor: AppointmentDoctor
    date: date
    start_time: str
    end_time: str
    status: Literal["scheduled", "cancelled", "completed", "no_show"]
    visit_reason: str | None
    can_change: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None
    cancelled_at: datetime | None = None
    cancellation_reason: str | None = None


class AppointmentList(DTO):
    total: int
    appointments: list[Appointment]


class Previous(DTO):
    date: date
    start_time: str


class Rescheduled(Appointment):
    previous: Previous


class Cancelled(DTO):
    id: int
    status: Literal["cancelled"]
    cancelled_at: datetime
