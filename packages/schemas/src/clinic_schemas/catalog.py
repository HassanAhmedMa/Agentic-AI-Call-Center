from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

MAX_CATALOG_ID = 9223372036854775807


class DTO(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Money(DTO):
    amount: float = Field(ge=0)
    currency: Literal["EGP"] = "EGP"


class Specialty(DTO):
    id: int
    name_en: str
    name_ar: str


class WorkingHours(DTO):
    start: str
    end: str


class Doctor(DTO):
    id: int
    name_en: str
    name_ar: str
    title_en: str
    title_ar: str
    specialty: Specialty
    languages: list[str]
    consultation_fee: Money
    shift_start: str | None = None
    shift_end: str | None = None
    working_days: list[str] | None = None
    working_hours: WorkingHours | None = None


class DoctorDetail(Doctor):
    bio_en: str
    bio_ar: str | None
    working_days: list[str]
    working_hours: WorkingHours


class Service(DTO):
    id: int
    name_en: str
    name_ar: str
    category: str
    price: Money
    duration_minutes: int


class ServiceDetail(Service):
    description_en: str
    description_ar: str | None
    preparation_instructions_en: str | None
    preparation_instructions_ar: str | None


class SpecialtyList(DTO):
    total: int
    specialties: list[Specialty]


class DoctorList(DTO):
    total: int
    doctors: list[Doctor]


class ServiceList(DTO):
    total: int
    services: list[Service]


class DoctorQuery(DTO):
    specialty_id: int | None = Field(default=None, gt=0, le=MAX_CATALOG_ID)
    q: str | None = Field(default=None, max_length=100, pattern=r"^[^\x00]*$")
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0, le=MAX_CATALOG_ID)


class ServiceQuery(DTO):
    category: str | None = Field(
        default=None, min_length=1, max_length=64, pattern=r"^[^\x00]*$"
    )
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0, le=MAX_CATALOG_ID)
