import base64
import json
from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore")

    database_url: SecretStr
    database_schema: str = Field(default="public", pattern=r"^[a-z_][a-z0-9_]{0,62}$")
    public_rate_limit: int = Field(default=60, ge=1, le=1000)
    booking_min_lead_minutes: int = Field(default=60, ge=60, le=1440)
    booking_horizon_days: int = Field(default=30, ge=1, le=30)
    migrations_dir: Path = Path("database/migrations")
    agent_service_token: SecretStr | None = None
    admin_api_token: SecretStr | None = None
    identity_enabled: bool = False
    identity_provider: Literal["clinic", "supabase"] = "clinic"
    supabase_url: str = ""
    supabase_public_key: SecretStr | None = None
    supabase_issuer: str = ""
    supabase_otp_length: int = Field(default=6, ge=6, le=10)
    supabase_otp_ttl_seconds: int = Field(default=3600, ge=60, le=86400)
    otp_hmac_secret: SecretStr | None = None
    smtp_host: str = "localhost"
    smtp_port: int = Field(default=1025, ge=1, le=65535)
    smtp_from: str = "clinic@example.test"
    smtp_username: str = ""
    smtp_password: SecretStr = SecretStr("")
    smtp_use_tls: bool = False
    email_delivery: Literal["smtp", "n8n"] = "smtp"
    n8n_webhook_url: str | None = None
    n8n_webhook_secret: SecretStr | None = None
    environment: str = "development"
    otp_ttl_seconds: int = Field(default=300, ge=60, le=900)
    otp_max_attempts: int = Field(default=3, ge=1, le=3)
    otp_max_sends_per_identity: int = Field(default=3, ge=1, le=10)
    otp_send_window_seconds: int = Field(default=900, ge=60, le=86400)
    otp_send_cooldown_seconds: int = Field(default=60, ge=1, le=3600)
    otp_max_sends_per_ip: int = Field(default=10, ge=1, le=100)
    otp_ip_window_seconds: int = Field(default=3600, ge=60, le=86400)
    otp_max_sends_per_conversation: int = Field(default=5, ge=1, le=5)
    otp_max_failures_per_ip: int = Field(default=20, ge=1, le=100)
    registration_max_per_ip_per_day: int = Field(default=3, ge=1, le=100)
    patient_session_idle_seconds: int = Field(default=900, ge=60, le=3600)
    patient_session_absolute_seconds: int = Field(default=3600, ge=60, le=86400)

    @model_validator(mode="after")
    def identity_configuration(self) -> "Settings":
        if self.admin_api_token:
            token = self.admin_api_token.get_secret_value()
            if len(token.encode()) < 32 or token.startswith("replace-with-"):
                raise ValueError("Admin token must be generated and at least 32 bytes")
            if self.admin_api_token in (self.agent_service_token, self.otp_hmac_secret):
                raise ValueError("Admin token must be distinct from other credentials")
        if self.supabase_public_key:
            key = self.supabase_public_key.get_secret_value()
            if key.startswith("sb_secret_"):
                raise ValueError("Use a Supabase public key, never a secret key")
            if key.count(".") == 2:
                try:
                    payload = key.split(".")[1]
                    role = json.loads(
                        base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4))
                    ).get("role")
                    if role != "anon":
                        raise ValueError("Public JWT must have the anon role")
                except (ValueError, AttributeError):
                    raise ValueError("Invalid public Auth key") from None
            elif self.environment not in {"development", "test"} and not key.startswith(
                "sb_publishable_"
            ):
                raise ValueError("Use a Supabase publishable or anon key")
        if self.supabase_url:
            url = urlsplit(self.supabase_url)
            local = (
                self.environment == "test"
                and url.scheme == "http"
                and url.hostname in {"127.0.0.1", "localhost"}
            )
            if (
                not url.hostname
                or url.username
                or url.password
                or url.query
                or url.fragment
                or url.path not in {"", "/"}
                or (url.scheme != "https" and not local)
            ):
                raise ValueError("Supabase requires a trusted HTTPS origin")
        if (
            self.identity_enabled
            and self.identity_provider == "supabase"
            and (not self.supabase_url or not self.supabase_public_key)
        ):
            raise ValueError("Supabase Auth URL and public key are required")
        if self.email_delivery == "n8n":
            url = urlsplit(self.n8n_webhook_url or "")
            local_test = (
                self.environment == "test"
                and url.scheme == "http"
                and url.hostname in {"localhost", "127.0.0.1", "::1"}
            )
            if (
                not url.hostname
                or not url.path
                or url.username
                or url.password
                or url.query
                or url.fragment
                or (url.scheme != "https" and not local_test)
            ):
                raise ValueError(
                    "n8n requires an HTTPS webhook URL without credentials/query"
                )
            secret = self.n8n_webhook_secret
            if (
                secret is None
                or len(secret.get_secret_value().encode()) < 32
                or secret.get_secret_value().startswith("replace-with-")
                or secret in (self.agent_service_token, self.otp_hmac_secret)
            ):
                raise ValueError("n8n requires a distinct generated webhook secret")
        if self.identity_enabled:
            secret = self.otp_hmac_secret
            if (
                secret is None
                or len(secret.get_secret_value().encode()) < 32
                or secret.get_secret_value().startswith("replace-with-")
            ):
                raise ValueError(
                    "Identity requires a generated OTP_HMAC_SECRET of at least 32 bytes"
                )
            if self.agent_service_token is None or secret == self.agent_service_token:
                raise ValueError("Identity requires distinct service and OTP secrets")
            if (
                self.environment not in {"development", "test"}
                and self.identity_provider == "clinic"
                and self.email_delivery == "smtp"
                and not self.smtp_use_tls
            ):
                raise ValueError("SMTP TLS is required outside development/test")
        return self

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
