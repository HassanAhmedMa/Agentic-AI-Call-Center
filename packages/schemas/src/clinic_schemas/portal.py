"""Patient portal inputs; passwords and callback credentials are never DTO output."""

import re

from pydantic import Field, SecretStr, field_validator, model_validator

from clinic_schemas.identity import Input, Registration


def normalize_phone(value: str) -> str:
    value = value.translate(
        str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")
    )
    value = re.sub(r"[\s()-]", "", value)
    if re.fullmatch(r"01[0125][0-9]{8}", value):
        value = "+20" + value[1:]
    elif re.fullmatch(r"1[0125][0-9]{8}", value):
        value = "+20" + value
    elif re.fullmatch(r"201[0125][0-9]{8}", value):
        value = "+" + value
    elif value.startswith("0020"):
        value = "+" + value[2:]
    if not re.fullmatch(r"\+[1-9][0-9]{7,14}", value):
        raise ValueError("Use an international phone number")
    return value


class Signup(Registration):
    password: SecretStr = Field(min_length=12, max_length=128)
    password_confirm: SecretStr = Field(min_length=12, max_length=128)

    @field_validator("phone", mode="before")
    @classmethod
    def phone_format(cls, value: object) -> str:
        if not isinstance(value, str):
            raise ValueError("Phone must be a string")
        return normalize_phone(value)

    @model_validator(mode="after")
    def same_password(self) -> "Signup":
        if self.password != self.password_confirm:
            raise ValueError("Passwords must match")
        return self


class Email(Input):
    email: str = Field(max_length=254)

    @field_validator("email")
    @classmethod
    def email_format(cls, value: str) -> str:
        return Registration.address(value)


class Verify(Email):
    code: SecretStr = Field(min_length=6, max_length=10)
    registration: Registration


class Login(Input):
    identifier: str = Field(min_length=1, max_length=254)
    password: SecretStr = Field(min_length=1, max_length=128)


class RecoverySession(Input):
    access_token: SecretStr = Field(min_length=1, max_length=16384)


class Reset(Email):
    password: SecretStr = Field(min_length=12, max_length=128)
    password_confirm: SecretStr = Field(min_length=12, max_length=128)

    @model_validator(mode="after")
    def same_password(self) -> "Reset":
        if self.password != self.password_confirm:
            raise ValueError("Passwords must match")
        return self


class Delivery(Input):
    delivery: str = "email"
