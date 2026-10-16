from datetime import UTC, datetime
from uuid import uuid4

import httpx
from clinic_backend.app import create_app
from clinic_backend.errors import APIError
from clinic_backend.settings import Settings
from clinic_backend.supabase_auth import VerifiedAuthUser
from sqlalchemy import text

from tests.integration.test_identity import FORM, SECRET, SERVICE


class Auth:
    def __init__(self):
        self.user = VerifiedAuthUser(uuid4(), FORM["email"], uuid4(), datetime.now(UTC))

    async def verify_access_token(self, token):
        return self.user

    async def send_existing_otp(self, email):
        pass

    async def logout(self, token):
        if getattr(self, "fail_logout", False):
            self.fail_logout = False
            raise APIError(503, "SERVICE_UNAVAILABLE", "Try again.")


async def test_supabase_completion_links_once_and_revocation_fails_closed(engine):
    auth = Auth()
    async with engine.begin() as conn:
        await conn.execute(text("""CREATE TABLE test_auth_sessions
            (user_id uuid, id uuid, not_after timestamptz)"""))
        await conn.execute(text("""CREATE FUNCTION auth_session_active(uuid,uuid)
            RETURNS boolean LANGUAGE SQL AS $$ SELECT EXISTS(
            SELECT 1 FROM test_auth_sessions WHERE user_id=$1 AND id=$2
            AND (not_after IS NULL OR not_after>now())) $$"""))
        await conn.execute(
            text("INSERT INTO test_auth_sessions VALUES (:u,:s,NULL)"),
            {"u": auth.user.user_id, "s": auth.user.session_id},
        )
    app = create_app(
        Settings(
            database_url="postgresql+asyncpg://unused@localhost/unused",
            identity_enabled=True,
            identity_provider="supabase",
            agent_service_token=SERVICE,
            otp_hmac_secret=SECRET,
            supabase_url="https://auth.example.test",
            supabase_public_key="test-public-key",
        ),
        engine=engine,
        auth_client=auth,
    )
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        token = (
            await client.post("/api/v1/conversations", json={"channel": "text"})
        ).json()["conversation_token"]
        headers = {"X-Conversation-Token": token, "Authorization": "Bearer test-token"}
        response = await client.post(
            "/api/v1/auth/complete", headers=headers, json=FORM
        )
        assert response.status_code == 200, response.text
        number = response.json()["customer_number"]
        assert (
            await client.post("/api/v1/auth/complete", headers=headers, json=FORM)
        ).json()["customer_number"] == number
        async with engine.connect() as conn:
            assert await conn.scalar(text("SELECT count(*) FROM patients")) == 1
        assert (
            await client.post("/api/v1/registrations", headers=headers, json=FORM)
        ).status_code == 404
        profile_headers = {"X-Conversation-Token": token, "X-Service-Token": SERVICE}
        assert (
            await client.get("/api/v1/patients/me", headers=profile_headers)
        ).status_code == 200
        auth.fail_logout = True
        assert (
            await client.post("/api/v1/auth/logout", headers=headers)
        ).status_code == 503
        assert (
            await client.post("/api/v1/auth/logout", headers=headers)
        ).status_code == 204
        async with engine.begin() as conn:
            await conn.execute(text("DELETE FROM test_auth_sessions"))
        assert (
            await client.get("/api/v1/patients/me", headers=profile_headers)
        ).status_code == 401
