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


def test_private_database_schema_configuration() -> None:
    from clinic_backend.database import connection_args

    settings = Settings(
        database_url="postgresql+asyncpg://user:pass@localhost/clinic",
        database_schema="clinic",
    )
    assert connection_args(settings)["server_settings"] == {
        "search_path": '"clinic", pg_catalog'
    }


@pytest.mark.parametrize(
    "schema", ["", "public,auth", "clinic;drop table patients", "a-b"]
)
def test_rejects_unsafe_database_schema(schema: str) -> None:
    with pytest.raises(ValidationError):
        Settings(
            database_url="postgresql+asyncpg://user:pass@localhost/clinic",
            database_schema=schema,
        )
