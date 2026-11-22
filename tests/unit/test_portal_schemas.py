import pytest
from clinic_schemas.portal import Signup, normalize_phone
from pydantic import ValidationError

from tests.integration.test_identity import FORM


@pytest.mark.parametrize(
    "value", ["01012345678", "1012345678", "+201012345678", "٠١٠١٢٣٤٥٦٧٨"]
)
def test_egyptian_phone_canonical(value):
    assert normalize_phone(value) == "+201012345678"


def test_signup_normalizes_phone_and_rejects_password_mismatch():
    form = Signup(
        **FORM,
        password="Synthetic-Password-123",
        password_confirm="Synthetic-Password-123",
    )
    assert form.phone == FORM["phone"]
    with pytest.raises(ValidationError):
        Signup(
            **FORM,
            password="Synthetic-Password-123",
            password_confirm="different-password-123",
        )
    assert "Synthetic-Password" not in repr(form)


@pytest.mark.parametrize("phone", [None, 12345, {}, []])
def test_signup_rejects_non_string_phone(phone):
    with pytest.raises(ValidationError):
        Signup(
            **{**FORM, "phone": phone},
            password="Synthetic-Password-123",
            password_confirm="Synthetic-Password-123",
        )
