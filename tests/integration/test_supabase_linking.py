import asyncio

import httpx
from clinic_backend.app import create_app
from clinic_backend.settings import Settings
from sqlalchemy import text

from tests.integration.test_identity import FORM, SECRET, SERVICE
from tests.integration.test_supabase_identity import Auth


async def test_existing_patient_link_is_concurrent_and_preserves_profile(engine):
    auth = Auth()
    async with engine.begin() as c:
        await c.execute(
            text("""CREATE TABLE test_auth_sessions(user_id uuid,id uuid)""")
        )
        await c.execute(text("""CREATE FUNCTION auth_session_active(uuid,uuid)
          RETURNS boolean LANGUAGE SQL AS $$ SELECT EXISTS(SELECT 1 FROM
          test_auth_sessions WHERE user_id=$1 AND id=$2) $$"""))
        await c.execute(
            text("INSERT INTO test_auth_sessions VALUES (:u,:s)"),
            {"u": auth.user.user_id, "s": auth.user.session_id},
        )
        await c.execute(
            text("""INSERT INTO patients(customer_number,full_name,
          email,email_verified_at,phone,date_of_birth) VALUES
          ('000000','Original Synthetic',:email,now(),'+201000000001','1988-01-01')"""),
            {"email": FORM["email"]},
        )
    app = create_app(
        Settings(
            database_url="postgresql+asyncpg://unused@localhost/unused",
            identity_enabled=True,
            identity_provider="supabase",
            agent_service_token=SERVICE,
            otp_hmac_secret=SECRET,
            supabase_url="https://auth.example.test",
            supabase_public_key="public-test-key",
        ),
        engine=engine,
        auth_client=auth,
    )
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        headers = []
        for _ in range(2):
            token = (
                await client.post("/api/v1/conversations", json={"channel": "text"})
            ).json()["conversation_token"]
            headers.append(
                {"X-Conversation-Token": token, "Authorization": "Bearer synthetic"}
            )
        results = await asyncio.gather(
            *(
                client.post("/api/v1/auth/complete", headers=h, json=FORM)
                for h in headers
            )
        )
        assert all(r.status_code == 200 for r in results)
        assert all(r.json()["customer_number"] == "000000" for r in results)
        async with engine.connect() as c:
            row = (
                await c.execute(text("SELECT full_name,supabase_user_id FROM patients"))
            ).one()
            assert (
                row.full_name == "Original Synthetic"
                and row.supabase_user_id == auth.user.user_id
            )
        wrong_email = await client.post(
            "/api/v1/auth/complete",
            headers=headers[0],
            json={**FORM, "email": "other@example.test"},
        )
        assert wrong_email.status_code == 409
        absent = await client.post(
            "/api/v1/auth/complete",
            headers={"X-Conversation-Token": headers[0]["X-Conversation-Token"]},
            json=FORM,
        )
        assert absent.status_code == 401
        forbidden = await client.post(
            "/api/v1/auth/complete",
            headers={**headers[0], "X-Service-Token": SERVICE},
            json=FORM,
        )
        assert forbidden.status_code == 403
