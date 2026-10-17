"""Bounded Supabase Auth transport. Credentials and responses are never logged."""

import asyncio
import base64
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from urllib.error import HTTPError, URLError
from urllib.request import Request, build_opener
from uuid import UUID

from clinic_backend.errors import APIError
from clinic_backend.mail import NoRedirect
from clinic_backend.settings import Settings


@dataclass(frozen=True)
class VerifiedAuthUser:
    user_id: UUID
    email: str
    session_id: UUID
    email_verified_at: datetime


class AuthClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def request(
        self,
        path: str,
        *,
        token: str = "",
        body: dict[str, object] | None = None,
        method: str | None = None,
    ) -> dict[str, object]:
        return await asyncio.to_thread(self._request, path, token, body, method)

    def _request(
        self,
        path: str,
        token: str,
        body: dict[str, object] | None,
        method: str | None = None,
    ) -> dict[str, object]:
        if not self.settings.supabase_url or not self.settings.supabase_public_key:
            raise APIError(
                503, "SERVICE_UNAVAILABLE", "Authentication is not configured."
            )
        headers = {
            "apikey": self.settings.supabase_public_key.get_secret_value(),
            "Content-Type": "application/json",
        }
        if token:
            headers["Authorization"] = "Bearer " + token
        request = Request(
            self.settings.supabase_url.rstrip("/") + "/auth/v1/" + path,
            headers=headers,
            method=method,
            data=json.dumps(body).encode() if body is not None else None,
        )
        try:
            with build_opener(NoRedirect()).open(request, timeout=10) as response:
                raw = response.read(131073)
                if len(raw) > 131072:
                    raise ValueError("Response too large")
                data = json.loads(raw) if raw else {}
                if not isinstance(data, dict):
                    raise ValueError("Expected object")
                return data
        except HTTPError as exc:
            if exc.code == 429:
                raise APIError(
                    429, "RATE_LIMITED", "Try again later.", {"retry_after": 60}
                ) from None
            if 400 <= exc.code < 500:
                raise APIError(
                    401, "VERIFICATION_REQUIRED", "Authentication required."
                ) from None
            raise APIError(
                503, "SERVICE_UNAVAILABLE", "Authentication unavailable."
            ) from None
        except (URLError, OSError, ValueError):
            raise APIError(
                503, "SERVICE_UNAVAILABLE", "Authentication unavailable."
            ) from None

    async def verify_access_token(self, token: str) -> VerifiedAuthUser:
        if not 1 <= len(token) <= 16384:
            raise APIError(401, "VERIFICATION_REQUIRED", "Authentication required.")
        user = await self.request("user", token=token)
        # Decode only AFTER the authoritative Auth server validates the token.
        try:
            payload = token.split(".")[1]
            claims = json.loads(
                base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4))
            )
            uid = UUID(str(user["id"]))
            sid = UUID(claims["session_id"])
            confirmed = datetime.fromisoformat(
                str(user["email_confirmed_at"]).replace("Z", "+00:00")
            )
            email = user["email"]
            if (
                claims["sub"] != str(uid)
                or claims["aud"] != "authenticated"
                or claims["iss"]
                != (
                    self.settings.supabase_issuer
                    or self.settings.supabase_url.rstrip("/") + "/auth/v1"
                )
                or not isinstance(claims["exp"], (int, float))
                or claims["exp"] <= datetime.now(UTC).timestamp()
                or confirmed.tzinfo is None
                or user.get("is_anonymous") is True
                or not isinstance(email, str)
                or "@" not in email
            ):
                raise ValueError("Invalid identity")
            return VerifiedAuthUser(uid, email.strip().lower(), sid, confirmed)
        except (KeyError, IndexError, TypeError, ValueError):
            raise APIError(
                401, "VERIFICATION_REQUIRED", "Verified email identity required."
            ) from None

    async def send_existing_otp(self, email: str) -> None:
        try:
            await self.request("otp", body={"email": email, "create_user": False})
        except APIError as exc:
            if exc.status != 401:
                raise

    async def logout(self, token: str) -> None:
        await self.request("logout?scope=local", token=token, body={})
