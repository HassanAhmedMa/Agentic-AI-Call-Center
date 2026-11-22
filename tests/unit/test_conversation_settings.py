import pytest
from clinic_backend.settings import Settings
from pydantic import ValidationError

URL = "postgresql+asyncpg://synthetic:synthetic@localhost/clinic"


@pytest.mark.parametrize("secret", ["short", "replace-with-at-least-32-random-bytes"])
def test_invalid_service_secret_is_rejected(secret):
    with pytest.raises(ValidationError):
        Settings(database_url=URL, agent_service_token=secret)


def test_empty_service_secret_disables_lifecycle_writes():
    assert (
        Settings(database_url=URL, agent_service_token="").agent_service_token is None
    )
