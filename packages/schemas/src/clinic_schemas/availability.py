import re
from datetime import date, time
from typing import Literal

from pydantic import Field, field_validator, model_validator

from clinic_schemas.catalog import DTO, MAX_CATALOG_ID


class AvailabilityQuery(DTO):
    from_date: date
    to_date: date | None = None

    @field_validator("from_date", "to_date", mode="before")
    @classmethod
    def strict_date(cls, value: object) -> object:
        if isinstance(value, str) and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            raise ValueError("Use YYYY-MM-DD")
        if value is not None and not isinstance(value, (str, date)):
            raise ValueError("Use a calendar date")
        return value

    @model_validator(mode="after")
    def bounded_range(self) -> "AvailabilityQuery":
        self.to_date = self.to_date or self.from_date
        if not 0 <= (self.to_date - self.from_date).days <= 6:
            raise ValueError("Request one to seven inclusive dates")
        return self


class SearchQuery(AvailabilityQuery):
    doctor_id: int | None = Field(default=None, gt=0, le=MAX_CATALOG_ID)
    specialty_id: int | None = Field(default=None, gt=0, le=MAX_CATALOG_ID)
    earliest_time: time | None = None
    latest_time: time | None = None
    limit: int = Field(default=5, ge=1, le=20)

    @field_validator("earliest_time", "latest_time", mode="before")
    @classmethod
    def strict_time(cls, value: object) -> object:
        if value is None:
            return None
        if not isinstance(value, str) or not re.fullmatch(
            r"(?:[01]\d|2[0-3]):[0-5]\d", value
        ):
            raise ValueError("Use HH:MM")
        return time.fromisoformat(value)

    @model_validator(mode="after")
    def ordered_times(self) -> "SearchQuery":
        if (
            self.earliest_time
            and self.latest_time
            and self.earliest_time >= self.latest_time
        ):
            raise ValueError("earliest_time must precede latest_time")
        return self


class SlotDay(DTO):
    date: date
    slots: list[str]
    closed: bool | None = None
    reason: (
        Literal[
            "CLINIC_CLOSED",
            "DOCTOR_UNAVAILABLE",
            "FULLY_BOOKED",
            "OUTSIDE_BOOKING_WINDOW",
        ]
        | None
    ) = None


class DoctorAvailability(DTO):
    doctor_id: int
    slot_minutes: Literal[30] = 30
    days: list[SlotDay]


class DoctorName(DTO):
    id: int
    name_en: str
    name_ar: str


class SearchResult(DTO):
    doctor: DoctorName
    date: date
    start_time: str


class AvailabilitySearch(DTO):
    results: list[SearchResult]
