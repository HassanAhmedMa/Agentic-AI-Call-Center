from datetime import date

import pytest
from clinic_backend.identity import customer_number, valid_customer_number
from clinic_schemas.identity import Registration
from pydantic import ValidationError


def test_random_customer_numbers_have_valid_luhn_digit():
    values = {customer_number() for _ in range(50)}
    assert len(values) > 40
    assert all(len(x) == 6 and valid_customer_number(x) for x in values)
    assert not valid_customer_number("12345")
    assert not valid_customer_number("１２３４５６")


def test_registration_normalizes_email_and_preserves_arabic_name():
    form = Registration(
        full_name="  أحمد منصور  ",
        email=" AHMED@Example.COM ",
        phone="+201012345678",
        date_of_birth="1988-04-15",
        preferred_language="ar",
        privacy_notice_accepted=True,
    )
    assert form.email == "ahmed@example.com" and form.full_name == "أحمد منصور"


@pytest.mark.parametrize(
    "field,value",
    [
        ("email", "not-email"),
        ("email", "a@example.com\r\nBcc: x@example.com"),
        ("phone", "01012345678"),
        ("privacy_notice_accepted", False),
        ("privacy_notice_accepted", "true"),
        ("date_of_birth", date.today().isoformat()),
        ("date_of_birth", "1800-01-01"),
        ("full_name", "  "),
        ("date_of_birth", 0),
        ("email", "a@"),
        ("email", "a@ "),
        ("email", "@"),
        ("email", ""),
    ],
)
def test_invalid_registration_rejected(field, value):
    data = dict(
        full_name="Synthetic Patient",
        email="patient@example.com",
        phone="+201012345678",
        date_of_birth="1988-04-15",
        preferred_language="en",
        privacy_notice_accepted=True,
    )
    data[field] = value
    with pytest.raises(ValidationError):
        Registration(**data)
