from pathlib import Path

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore")

    database_url: SecretStr
    public_rate_limit: int = Field(default=60, ge=1, le=1000)
    migrations_dir: Path = Path("database/migrations")
    agent_service_token: SecretStr | None = None

    @field_validator("agent_service_token")
    @classmethod
    def service_token_strength(cls, value: SecretStr | None) -> SecretStr | None:
        if value is not None and value.get_secret_value() == "":
            return None
        if value is not None and (
            len(value.get_secret_value().encode()) < 32
            or value.get_secret_value().startswith("replace-with-")
        ):
            raise ValueError(
                "AGENT_SERVICE_TOKEN must be a generated secret, at least 32 bytes"
            )
        return value

    @field_validator("database_url")
    @classmethod
    def postgres_only(cls, value: SecretStr) -> SecretStr:
        try:
            url = make_url(value.get_secret_value())
        except (ArgumentError, ValueError) as exc:
            raise ValueError("Invalid PostgreSQL database URL") from exc
        if url.drivername != "postgresql+asyncpg" or not url.host or not url.database:
            raise ValueError(
                "DATABASE_URL must use postgresql+asyncpg with host/database"
            )
        return value
