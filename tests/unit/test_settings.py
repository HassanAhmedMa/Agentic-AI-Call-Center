import pytest
from clinic_backend.settings import Settings
from pydantic import ValidationError


def test_accepts_postgresql_async_url() -> None:
    settings = Settings(database_url="postgresql+asyncpg://user:pass@localhost/clinic")
    assert settings.database_url.get_secret_value().startswith("postgresql+asyncpg://")


@pytest.mark.parametrize("url", ["sqlite:///clinic.db", "https://localhost", ""])
def test_rejects_non_postgres_urls(url: str) -> None:
    with pytest.raises(ValidationError):
        Settings(database_url=url)
