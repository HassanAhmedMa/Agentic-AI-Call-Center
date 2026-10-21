import asyncio
import re

import httpx
import pytest
from clinic_backend.app import create_app
from clinic_backend.settings import Settings
from sqlalchemy import text

SERVICE = "synthetic-service-token-for-tests-only-123456789"
SECRET = "different-synthetic-otp-secret-for-tests-123456789"
FORM = dict(
    full_name="Synthetic Patient",
    email="patient@example.com",
    phone="+201012345678",
    date_of_birth="1988-04-15",
    preferred_language="en",
    privacy_notice_accepted=True,
)


class Inbox:
    def __init__(self):
        self.messages = []
        self.accepting = True

    def available(self):
        return self.accepting

    def reserve(self):
        return self.accepting

    def release(self):
        pass

    def enqueue(self, message):
        if message is not None:
            self.messages.append(message)

    async def close(self):
        pass

    def code(self):
        return re.search(r"\b[0-9]{6}\b", self.messages[-1].body).group()


@pytest.fixture
async def identity_client(engine):
    inbox = Inbox()
    app = create_app(
        Settings(
            database_url="postgresql+asyncpg://unused:unused@localhost/unused",
            agent_service_token=SERVICE,
            identity_enabled=True,
            otp_hmac_secret=SECRET,
        ),
        engine=engine,
        mailer=inbox,
    )
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/api/v1/conversations", json={"channel": "text"})
        token = response.json()["conversation_token"]
        yield client, inbox, {"X-Conversation-Token": token}


async def register(client, headers, data=None):
    response = await client.post(
        "/api/v1/registrations", headers=headers, json=data or FORM
    )
    assert response.status_code == 202, response.text
    return response


async def verify(client, headers, code, purpose="registration"):
    return await client.post(
        "/api/v1/verification/verify",
        headers=headers,
        json={"purpose": purpose, "code": code},
    )


async def test_registration_requires_email_code_and_creates_one_bound_patient(
    identity_client, engine
):
    client, inbox, headers = identity_client
    await register(client, headers)
    assert inbox.messages[-1].recipient == FORM["email"]
    code = inbox.code()
    async with engine.connect() as conn:
        assert await conn.scalar(text("SELECT count(*) FROM patients")) == 0
        row = (
            await conn.execute(
                text(
                    "SELECT code_hash,pending_registration FROM verification_challenges"
                )
            )
        ).one()
        assert row.code_hash and code.encode() != row.code_hash
    result = await verify(client, headers, code)
    assert result.status_code == 200, result.text
    number = result.json()["customer_number"]
    assert len(number) == 6
    poll = await client.get(
        "/api/v1/conversations/current/verification", headers=headers
    )
    assert poll.json()["state"] == "verified" and "email" not in poll.text
    profile = await client.get(
        "/api/v1/patients/me", headers={**headers, "X-Service-Token": SERVICE}
    )
    assert profile.json() == {
        "customer_number": number,
        "first_name": "Synthetic",
        "preferred_language": "en",
    }
    assert (await verify(client, headers, code)).status_code == 409
    async with engine.connect() as conn:
        row = (
            await conn.execute(
                text(
                    "SELECT code_hash,pending_registration,status "
                    "FROM verification_challenges"
                )
            )
        ).one()
        assert (
            row.status == "verified"
            and row.code_hash is None
            and row.pending_registration is None
        )


async def test_three_wrong_codes_fail_and_wipe_form(identity_client, engine):
    client, inbox, headers = identity_client
    await register(client, headers)
    wrong = "000000" if inbox.code() != "000000" else "111111"
    for remaining in [2, 1, 0]:
        response = await verify(client, headers, wrong)
        assert response.status_code == 422
        assert response.json()["error"]["details"]["attempts_remaining"] == remaining
    assert (await verify(client, headers, inbox.code())).status_code == 410
    async with engine.connect() as conn:
        row = (
            await conn.execute(
                text(
                    "SELECT pending_registration,code_hash FROM verification_challenges"
                )
            )
        ).one()
        assert row.pending_registration is None and row.code_hash is None


async def test_expired_code_does_not_create_patient(identity_client, engine):
    client, inbox, headers = identity_client
    await register(client, headers)
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "UPDATE verification_challenges "
                "SET expires_at=now()-interval '1 second'"
            )
        )
    assert (await verify(client, headers, inbox.code())).status_code == 410
    async with engine.connect() as conn:
        assert await conn.scalar(text("SELECT count(*) FROM patients")) == 0
        assert (
            await conn.scalar(
                text("SELECT pending_registration FROM verification_challenges")
            )
            is None
        )


async def test_browser_routes_reject_service_token_before_body(identity_client):
    client, _, headers = identity_client
    for path in ["registrations", "verification/verify"]:
        response = await client.post(
            "/api/v1/" + path, headers={**headers, "X-Service-Token": ""}, json={}
        )
        assert response.status_code == 403


async def test_logout_and_conversation_end_revoke_binding(identity_client, engine):
    client, inbox, headers = identity_client
    await register(client, headers)
    await verify(client, headers, inbox.code())
    response = await client.post(
        "/api/v1/patients/me/logout", headers={**headers, "X-Service-Token": SERVICE}
    )
    assert response.status_code == 204
    assert (
        await client.get("/api/v1/conversations/current/verification", headers=headers)
    ).json() == {"state": "none"}
    async with engine.connect() as conn:
        assert (
            await conn.scalar(text("SELECT revoke_reason FROM patient_sessions"))
            == "logout"
        )


async def test_login_code_uses_email_on_file(identity_client):
    client, inbox, headers = identity_client
    await register(client, headers)
    result = await verify(client, headers, inbox.code())
    number = result.json()["customer_number"]
    # Advance limiter window using a separate conversation and distinct login bucket.
    response = await client.post(
        "/api/v1/verification/challenges",
        headers={**headers, "X-Service-Token": SERVICE},
        json={"customer_number": number},
    )
    assert response.status_code == 202 and "email" not in response.json()
    assert inbox.messages[-1].recipient == FORM["email"]
    assert (await verify(client, headers, inbox.code(), "login")).status_code == 200


async def test_duplicate_email_never_links_existing_account(identity_client, engine):
    client, inbox, headers = identity_client
    await register(client, headers)
    await verify(client, headers, inbox.code())
    other = await client.post("/api/v1/conversations", json={"channel": "text"})
    new_headers = {"X-Conversation-Token": other.json()["conversation_token"]}
    async with engine.begin() as conn:
        await conn.execute(
            text("UPDATE rate_limit_events SET created_at=now()-interval '61 seconds'")
        )
    result = await register(client, new_headers)
    assert set(result.json()) == {"state", "purpose", "expires_at"}
    assert "Someone tried" in inbox.messages[-1].body
    response = await verify(client, new_headers, "123456")
    assert response.status_code == 422
    profile = await client.get(
        "/api/v1/patients/me", headers={**new_headers, "X-Service-Token": SERVICE}
    )
    assert profile.status_code == 401
    async with engine.connect() as conn:
        assert await conn.scalar(text("SELECT count(*) FROM patients")) == 1


async def test_registration_race_for_same_email_creates_one_account(
    identity_client, engine
):
    client, inbox, headers = identity_client
    await register(client, headers)
    first_code = inbox.code()
    async with engine.begin() as conn:
        await conn.execute(
            text("UPDATE rate_limit_events SET created_at=now()-interval '61 seconds'")
        )
    other = await client.post("/api/v1/conversations", json={"channel": "text"})
    second_headers = {"X-Conversation-Token": other.json()["conversation_token"]}
    await register(client, second_headers)
    second_code = inbox.code()
    responses = await asyncio.gather(
        verify(client, headers, first_code), verify(client, second_headers, second_code)
    )
    assert sorted(r.status_code for r in responses) == [200, 422]
    async with engine.connect() as conn:
        assert await conn.scalar(text("SELECT count(*) FROM patients")) == 1
        assert (
            await conn.scalar(
                text("SELECT count(*) FROM patient_sessions WHERE revoked_at IS NULL")
            )
            == 1
        )


async def test_same_code_double_submit_consumes_once(identity_client, engine):
    client, inbox, headers = identity_client
    await register(client, headers)
    code = inbox.code()
    responses = await asyncio.gather(
        verify(client, headers, code), verify(client, headers, code)
    )
    assert sorted(r.status_code for r in responses) == [200, 409]
    async with engine.connect() as conn:
        assert await conn.scalar(text("SELECT count(*) FROM patients")) == 1


@pytest.mark.parametrize(
    "field,interval", [("last_activity_at", "16 minutes"), ("expires_at", "1 second")]
)
async def test_expired_session_is_revoked_without_poll_refresh(
    identity_client, engine, field, interval
):
    client, inbox, headers = identity_client
    await register(client, headers)
    await verify(client, headers, inbox.code())
    async with engine.begin() as conn:
        await conn.execute(
            text(f"UPDATE patient_sessions SET {field}=now()-interval '{interval}'")
        )
    assert (
        await client.get("/api/v1/conversations/current/verification", headers=headers)
    ).json() == {"state": "none"}
    response = await client.get(
        "/api/v1/patients/me", headers={**headers, "X-Service-Token": SERVICE}
    )
    assert (
        response.status_code == 401
        and response.json()["error"]["code"] == "SESSION_EXPIRED"
    )
    async with engine.connect() as conn:
        assert (
            await conn.scalar(text("SELECT revoked_at FROM patient_sessions"))
            is not None
        )


@pytest.mark.parametrize("end", [True, False])
async def test_conversation_end_or_resume_expiry_revokes_identity(
    identity_client, engine, end
):
    client, inbox, headers = identity_client
    await register(client, headers)
    await verify(client, headers, inbox.code())
    if end:
        response = await client.post(
            "/api/v1/conversations/current/events",
            headers={**headers, "X-Service-Token": SERVICE},
            json={"event": "ended"},
        )
        assert response.status_code == 204
    else:
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    "UPDATE conversation_sessions SET status='disconnected',"
                    "disconnected_at=now()-interval '6 minutes'"
                )
            )
        assert (
            await client.get(
                "/api/v1/conversations/current/verification", headers=headers
            )
        ).status_code == 401
    async with engine.connect() as conn:
        assert await conn.scalar(
            text("SELECT revoke_reason FROM patient_sessions")
        ) == ("call_ended" if end else "resume_expired")


async def test_unknown_customer_is_generic_and_code_always_fails(identity_client):
    from clinic_backend.identity import customer_number

    client, inbox, headers = identity_client
    number = customer_number()
    response = await client.post(
        "/api/v1/verification/challenges",
        headers={**headers, "X-Service-Token": SERVICE},
        json={"customer_number": number},
    )
    assert response.status_code == 202
    assert response.json()["delivery"] == "email_on_file" and not inbox.messages
    assert (await verify(client, headers, "123456", "login")).status_code == 422


async def test_cooldown_and_registration_ip_limits(identity_client, engine):
    client, inbox, headers = identity_client
    await register(client, headers)
    response = await client.post("/api/v1/registrations", headers=headers, json=FORM)
    assert response.status_code == 429 and int(response.headers["Retry-After"]) > 0
    for index in [1, 2]:
        other = await client.post("/api/v1/conversations", json={"channel": "text"})
        await register(
            client,
            {"X-Conversation-Token": other.json()["conversation_token"]},
            {**FORM, "email": f"synthetic{index}@example.com"},
        )
    response = await client.post(
        "/api/v1/registrations",
        headers=headers,
        json={**FORM, "email": "synthetic3@example.com"},
    )
    assert response.status_code == 429
    async with engine.connect() as conn:
        subjects = list(
            (
                await conn.execute(
                    text(
                        "SELECT subject FROM rate_limit_events "
                        "WHERE bucket='otp_send:email'"
                    )
                )
            ).scalars()
        )
    assert all("@" not in subject for subject in subjects)


async def test_cleanup_clears_expired_forms_and_keeps_session_audit(
    identity_client, engine
):
    from clinic_backend.identity_cleanup import cleanup
    from sqlalchemy.ext.asyncio import async_sessionmaker

    client, inbox, headers = identity_client
    await register(client, headers)
    await verify(client, headers, inbox.code())
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "UPDATE verification_challenges "
                "SET created_at=now()-interval '25 hours'"
            )
        )
    settings = Settings(
        database_url="postgresql+asyncpg://unused:unused@localhost/unused",
        agent_service_token=SERVICE,
        otp_hmac_secret=SECRET,
        identity_enabled=True,
    )
    await cleanup(async_sessionmaker(engine, expire_on_commit=False), settings)
    async with engine.connect() as conn:
        assert (
            await conn.scalar(text("SELECT count(*) FROM verification_challenges")) == 0
        )
        assert await conn.scalar(text("SELECT count(*) FROM patient_sessions")) == 1
        assert (
            await conn.scalar(text("SELECT verified_via FROM patient_sessions")) is None
        )


async def test_bilingual_page_has_no_service_credentials(identity_client):
    client, _, _ = identity_client
    page = await client.get("/register")
    assert page.status_code == 200 and 'dir="rtl"' in page.text
    assert "Create your account" in page.text and "سجّل حسابك" in page.text
    script = await client.get("/identity-assets/register.js")
    assert SERVICE not in script.text and SECRET not in script.text
    assert "X-Service-Token" not in script.text and "localStorage" not in script.text


async def test_full_mail_queue_prevents_registration_mutations(identity_client, engine):
    client, inbox, headers = identity_client
    inbox.accepting = False
    response = await client.post("/api/v1/registrations", headers=headers, json=FORM)
    assert response.status_code == 503
    async with engine.connect() as conn:
        assert (
            await conn.scalar(text("SELECT count(*) FROM verification_challenges")) == 0
        )
        assert (
            await conn.scalar(
                text(
                    "SELECT count(*) FROM rate_limit_events "
                    "WHERE bucket='registration:ip'"
                )
            )
            == 0
        )


async def test_full_mail_queue_does_not_hide_verified_account(identity_client, engine):
    client, inbox, headers = identity_client
    await register(client, headers)
    code = inbox.code()
    inbox.accepting = False
    response = await verify(client, headers, code)
    assert response.status_code == 200 and len(response.json()["customer_number"]) == 6
    async with engine.connect() as conn:
        assert await conn.scalar(text("SELECT count(*) FROM patients")) == 1


async def test_conversation_send_cap_survives_rate_event_retention(
    identity_client, engine
):
    from clinic_backend.identity import customer_number
    from clinic_backend.identity_cleanup import cleanup
    from sqlalchemy.ext.asyncio import async_sessionmaker

    client, _, headers = identity_client
    for _ in range(5):
        response = await client.post(
            "/api/v1/verification/challenges",
            headers={**headers, "X-Service-Token": SERVICE},
            json={"customer_number": customer_number()},
        )
        assert response.status_code == 202
    async with engine.begin() as conn:
        await conn.execute(
            text("UPDATE rate_limit_events SET created_at=now()-interval '25 hours'")
        )
    settings = Settings(
        database_url="postgresql+asyncpg://unused:unused@localhost/unused",
        agent_service_token=SERVICE,
        otp_hmac_secret=SECRET,
        identity_enabled=True,
    )
    await cleanup(async_sessionmaker(engine, expire_on_commit=False), settings)
    response = await client.post(
        "/api/v1/verification/challenges",
        headers={**headers, "X-Service-Token": SERVICE},
        json={"customer_number": customer_number()},
    )
    assert response.status_code == 429


async def test_pending_login_is_visible_while_existing_session_remains(identity_client):
    client, inbox, headers = identity_client
    await register(client, headers)
    result = await verify(client, headers, inbox.code())
    await client.post(
        "/api/v1/verification/challenges",
        headers={**headers, "X-Service-Token": SERVICE},
        json={"customer_number": result.json()["customer_number"]},
    )
    poll = await client.get(
        "/api/v1/conversations/current/verification", headers=headers
    )
    assert poll.json()["state"] == "pending" and poll.json()["purpose"] == "login"


async def test_verification_poll_does_not_extend_idle_timeout(identity_client, engine):
    client, inbox, headers = identity_client
    await register(client, headers)
    await verify(client, headers, inbox.code())
    async with engine.connect() as conn:
        original = await conn.scalar(
            text("SELECT last_activity_at FROM patient_sessions")
        )
    assert (
        await client.get("/api/v1/conversations/current/verification", headers=headers)
    ).json()["state"] == "verified"
    async with engine.connect() as conn:
        assert (
            await conn.scalar(text("SELECT last_activity_at FROM patient_sessions"))
            == original
        )
