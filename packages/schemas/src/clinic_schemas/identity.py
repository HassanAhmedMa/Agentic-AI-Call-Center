import re
from datetime import date, datetime
from email.errors import HeaderParseError
from email.headerregistry import Address
from typing import Literal
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, StrictBool, field_validator


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Registration(Input):
    full_name: str = Field(min_length=1, max_length=255, strict=True)
    phone: str = Field(pattern=r"^\+[1-9][0-9]{7,14}$", strict=True)
    date_of_birth: date
    email: str = Field(max_length=254, strict=True)
    preferred_language: Literal["ar", "en"] = "ar"
    privacy_notice_accepted: StrictBool

    @field_validator("date_of_birth", mode="before")
    @classmethod
    def birth_format(cls, value: object) -> object:
        if isinstance(value, date) and not isinstance(value, datetime):
            return value
        if not isinstance(value, str) or not re.fullmatch(
            r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value
        ):
            raise ValueError("Use YYYY-MM-DD")
        return value

    @field_validator("full_name")
    @classmethod
    def name(cls, value: str) -> str:
        value = value.strip()
        if not value or any(ord(c) < 32 for c in value):
            raise ValueError("Invalid name")
        return value

    @field_validator("email")
    @classmethod
    def address(cls, value: str) -> str:
        value = value.strip().lower()
        if any(ord(c) < 32 for c in value):
            raise ValueError("Invalid email")
        try:
            parsed = Address(addr_spec=value)
            domain = parsed.domain.encode("idna").decode("ascii")
        except (ValueError, UnicodeError, HeaderParseError, IndexError) as exc:
            raise ValueError("Invalid email") from exc
        if (
            not parsed.username.isascii()
            or len(parsed.username) > 64
            or not re.fullmatch(r"[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?", domain)
            or "." not in domain
            or any(
                not part or part.startswith("-") or part.endswith("-") or len(part) > 63
                for part in domain.split(".")
            )
        ):
            raise ValueError("Invalid email")
        normalized = Address(username=parsed.username, domain=domain).addr_spec
        if len(normalized) > 254:
            raise ValueError("Invalid email")
        return normalized

    @field_validator("date_of_birth")
    @classmethod
    def birth(cls, value: date) -> date:
        today = datetime.now(ZoneInfo("Africa/Cairo")).date()
        age = (
            today.year
            - value.year
            - ((today.month, today.day) < (value.month, value.day))
        )
        if value >= today or age > 120:
            raise ValueError("Invalid date of birth")
        return value

    @field_validator("privacy_notice_accepted")
    @classmethod
    def consent(cls, value: bool) -> bool:
        if not value:
            raise ValueError("Privacy notice must be accepted")
        return value


class ChallengeRequest(Input):
    customer_number: str = Field(strict=True, max_length=128)


class CodeEntry(Input):
    purpose: Literal["login", "registration"]
    code: str = Field(strict=True, pattern=r"^[0-9]{6}$")


class ChallengeResponse(BaseModel):
    state: Literal["pending"] = "pending"
    purpose: Literal["login", "registration"]
    expires_at: datetime
    delivery: Literal["email_on_file"] | None = None


class VerificationState(BaseModel):
    state: Literal["none", "pending", "verified"]
    purpose: Literal["login", "registration"] | None = None
    expires_at: datetime | None = None
    verified_at: datetime | None = None


class Verified(BaseModel):
    state: Literal["verified"] = "verified"
    purpose: Literal["login", "registration"]
    customer_number: str | None = None


class PatientProfile(BaseModel):
    customer_number: str
    first_name: str
    preferred_language: Literal["ar", "en"]
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    date_of_birth: date | None = None
    gender: str | None = None
    address: str | None = None
