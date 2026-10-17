import base64
import hashlib
from datetime import UTC, datetime
from urllib.parse import parse_qs, urlsplit
from uuid import uuid4

import httpx
import pytest
from clinic_backend.app import create_app
from clinic_backend.errors import APIError
from clinic_backend.settings import Settings
from clinic_backend.supabase_auth import VerifiedAuthUser
from sqlalchemy import text

from tests.integration.test_identity import FORM, SECRET, SERVICE

PASSWORD = "Synthetic-Password-123"


class Provider:
    def __init__(self):
        self.user = VerifiedAuthUser(uuid4(), FORM["email"], uuid4(), datetime.now(UTC))
        self.calls = []
        self.valid = True

    async def request(self, path, *, token="", body=None, method=None):
        self.calls.append((path, body, method))
        if (
            path == "signup"
            or path.startswith("recover")
            or path == "resend"
            or path.startswith("logout")
            or path == "user"
        ):
            return {}
        if (
            path.startswith("token?grant_type=password")
            and body.get("password") != PASSWORD
        ):
            raise APIError(401, "VERIFICATION_REQUIRED", "Invalid credentials")
        if path == "verify" and body.get("token") != "123456":
            raise APIError(401, "VERIFICATION_REQUIRED", "Invalid code")
        return {
            "access_token": "synthetic-access",
            "refresh_token": "synthetic-refresh",
        }

    async def verify_access_token(self, token):
        if not self.valid or token != "synthetic-access":
            raise APIError(401, "VERIFICATION_REQUIRED", "Invalid session")
        return self.user


@pytest.fixture
async def portal(engine, request):
    provider = Provider()
    async with engine.begin() as c:
        await c.execute(
            text(
                "CREATE FUNCTION auth_session_active(uuid,uuid) RETURNS boolean "
                "LANGUAGE SQL AS $$ SELECT true $$"
            )
        )
    app = create_app(
        Settings(
            database_url="postgresql+asyncpg://unused@localhost/unused",
            identity_enabled=True,
            identity_provider="supabase",
            portal_enabled=True,
            portal_google_enabled=True,
            portal_origin="http://test",
            portal_cookie_secure=getattr(request, "param", False),
            environment="test",
            supabase_url="https://auth.example.test",
            supabase_public_key="synthetic-public-key",
            agent_service_token=SERVICE,
            otp_hmac_secret=SECRET,
        ),
        engine=engine,
        auth_client=provider,
    )
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
        headers={"Origin": "http://test"},
    ) as client:
        yield client, provider


async def test_portal_signup_verify_session_login_and_duplicate_phone(portal):
    client, provider = portal
    body = {**FORM, "password": PASSWORD, "password_confirm": PASSWORD}
    assert (await client.post("/api/v1/portal/signup", json=body)).status_code == 202
    verify = await client.post(
        "/api/v1/portal/verify",
        json={"email": FORM["email"], "code": "123456", "registration": FORM},
    )
    assert verify.status_code == 200, verify.text
    number = verify.json()["customer_number"]
    assert "synthetic-access" not in verify.text
    assert "HttpOnly" in verify.headers["set-cookie"]
    assert (await client.get("/api/v1/portal/session")).json()[
        "customer_number"
    ] == number
    duplicate = await client.post(
        "/api/v1/portal/signup", json={**body, "email": "different@example.test"}
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "PHONE_ALREADY_REGISTERED"
    assert (await client.post("/api/v1/portal/logout", json={})).status_code == 204
    assert (await client.get("/api/v1/portal/session")).status_code == 401
    login = await client.post(
        "/api/v1/portal/login", json={"identifier": "01012345678", "password": PASSWORD}
    )
    assert login.status_code == 200, login.text
    assert login.json()["customer_number"] == number
    assert any(
        path.startswith("token") and body["email"] == FORM["email"]
        for path, body, _ in provider.calls
    )


async def test_portal_origin_and_recovery_email_match(portal):
    client, provider = portal
    denied = await client.post(
        "/api/v1/portal/recover",
        json={"email": FORM["email"]},
        headers={"Origin": "https://outside.example"},
    )
    assert denied.status_code == 403
    assert (
        await client.post(
            "/api/v1/portal/recover", json={"email": "unknown@example.test"}
        )
    ).status_code == 202
    assert (
        await client.post(
            "/api/v1/portal/recovery-session",
            json={
                "access_token": "synthetic-access",
            },
        )
    ).status_code == 204
    wrong = await client.post(
        "/api/v1/portal/reset-password",
        json={
            "email": "other@example.test",
            "password": PASSWORD,
            "password_confirm": PASSWORD,
        },
    )
    assert wrong.status_code == 401
    valid = await client.post(
        "/api/v1/portal/reset-password",
        json={
            "email": FORM["email"],
            "password": PASSWORD,
            "password_confirm": PASSWORD,
        },
    )
    assert valid.status_code == 204, valid.text
    assert any(path == "user" and method == "PUT" for path, _, method in provider.calls)


async def test_wrong_password_and_wrong_otp_never_authenticate(portal):
    client, _ = portal
    wrong = await client.post(
        "/api/v1/portal/login",
        json={"identifier": FORM["email"], "password": "Incorrect-password"},
    )
    assert wrong.status_code == 401
    wrong = await client.post(
        "/api/v1/portal/verify",
        json={"email": FORM["email"], "code": "654321", "registration": FORM},
    )
    assert wrong.status_code == 401
    assert (await client.get("/api/v1/portal/session")).status_code == 401


async def test_verified_profile_can_retry_after_phone_conflict(portal, engine):
    client, provider = portal
    async with engine.begin() as connection:
        await connection.execute(
            text("""INSERT INTO patients(customer_number,
            full_name,email,email_verified_at,phone,date_of_birth)
            VALUES ('999999','Synthetic Existing','existing@example.test',now(),
            :phone,'1988-01-01')"""),
            {"phone": FORM["phone"]},
        )
    verify = {"email": FORM["email"], "code": "123456", "registration": FORM}
    conflict = await client.post("/api/v1/portal/verify", json=verify)
    assert conflict.status_code == 409, conflict.text
    assert conflict.json()["error"]["details"]["email_verified"] is True
    assert (await client.get("/api/v1/portal/session")).status_code == 401
    calls_before = sum(path == "verify" for path, _, _ in provider.calls)
    fixed = await client.post(
        "/api/v1/portal/verify",
        json={
            **verify,
            "code": "000000",
            "registration": {**FORM, "phone": "+201012345679"},
        },
    )
    assert fixed.status_code == 200, fixed.text
    assert sum(path == "verify" for path, _, _ in provider.calls) == calls_before


async def test_database_enforces_unique_phone_and_case_insensitive_email(engine):
    from sqlalchemy.exc import IntegrityError

    insert = text("""INSERT INTO patients(customer_number,full_name,email,
        email_verified_at,phone,date_of_birth) VALUES
        (:number,'Synthetic',:email,now(),:phone,'1988-01-01')""")
    async with engine.begin() as connection:
        await connection.execute(
            insert,
            {
                "number": "123456",
                "email": "unique@example.test",
                "phone": "+201012345678",
            },
        )
    for number, email, phone in [
        ("123457", "other@example.test", "+201012345678"),
        ("123458", "UNIQUE@example.test", "+201012345679"),
    ]:
        with pytest.raises(IntegrityError):
            async with engine.begin() as connection:
                await connection.execute(
                    insert, {"number": number, "email": email, "phone": phone}
                )


async def test_invalid_recovery_identity_does_not_set_reset_cookie(portal):
    client, provider = portal
    provider.valid = False
    result = await client.post(
        "/api/v1/portal/recovery-session", json={"access_token": "expired-token"}
    )
    assert result.status_code == 401
    assert "clinic_portal_recovery" not in client.cookies
    result = await client.post(
        "/api/v1/portal/reset-password",
        json={
            "email": FORM["email"],
            "password": PASSWORD,
            "password_confirm": PASSWORD,
        },
    )
    assert result.status_code == 401
    assert not any(method == "PUT" for _, _, method in provider.calls)


async def test_confirmed_auth_account_can_finish_missing_clinic_profile(portal):
    client, provider = portal
    result = await client.post(
        "/api/v1/portal/login", json={"identifier": FORM["email"], "password": PASSWORD}
    )
    assert result.status_code == 409
    assert result.json()["error"]["details"]["email_verified"] is True
    result = await client.post(
        "/api/v1/portal/verify",
        json={"email": FORM["email"], "code": "000000", "registration": FORM},
    )
    assert result.status_code == 200, result.text
    assert not any(path == "verify" for path, _, _ in provider.calls)


async def test_portal_assets_and_origin_protection(portal):
    client, _ = portal
    result = await client.get("/portal/auth.html")
    assert result.status_code == 200
    assert result.headers["referrer-policy"] == "no-referrer"
    assert result.headers["cache-control"] == "no-store"
    assert (await client.get("/portal/.env")).status_code == 404
    assert (
        await client.post(
            "/api/v1/portal/resend",
            json={"email": FORM["email"]},
            headers={"Origin": "null"},
        )
    ).status_code == 403


async def test_verified_profile_retry_is_not_blocked_by_used_otp_attempts(
    portal, engine
):
    import hashlib
    import hmac

    client, _ = portal
    response = await client.post(
        "/api/v1/portal/login", json={"identifier": FORM["email"], "password": PASSWORD}
    )
    assert response.status_code == 409
    subject = hmac.new(
        SECRET.encode(), FORM["email"].encode(), hashlib.sha256
    ).hexdigest()
    async with engine.begin() as connection:
        await connection.execute(
            text("""INSERT INTO rate_limit_events(bucket,subject)
            SELECT 'portal_verify:identity', :subject FROM generate_series(1,5)"""),
            {"subject": subject},
        )
    response = await client.post(
        "/api/v1/portal/verify",
        json={"email": FORM["email"], "code": "000000", "registration": FORM},
    )
    assert response.status_code == 200, response.text
    assert (await client.get("/api/v1/portal/session")).status_code == 200


async def test_unverified_cookie_cannot_bypass_otp_rate_limit(portal, engine):
    import hashlib
    import hmac

    client, _ = portal
    client.cookies.set("clinic_portal_access", "invalid-access")
    client.cookies.set("clinic_portal_refresh", "invalid-refresh")
    subject = hmac.new(
        SECRET.encode(), FORM["email"].encode(), hashlib.sha256
    ).hexdigest()
    async with engine.begin() as connection:
        await connection.execute(
            text("""INSERT INTO rate_limit_events(bucket,subject)
            SELECT 'portal_verify:identity', :subject FROM generate_series(1,5)"""),
            {"subject": subject},
        )
    response = await client.post(
        "/api/v1/portal/verify",
        json={"email": FORM["email"], "code": "123456", "registration": FORM},
    )
    assert response.status_code == 429
    assert (await client.get("/api/v1/portal/session")).status_code == 401


async def test_profile_throttle_preserves_retry_information(portal, engine):
    client, _ = portal
    await client.post(
        "/api/v1/portal/login", json={"identifier": FORM["email"], "password": PASSWORD}
    )
    async with engine.begin() as connection:
        await connection.execute(text("""INSERT INTO rate_limit_events(bucket,subject)
            SELECT 'registration:ip','127.0.0.1' FROM generate_series(1,3)"""))
    result = await client.post(
        "/api/v1/portal/verify",
        json={"email": FORM["email"], "code": "000000", "registration": FORM},
    )
    assert result.status_code == 429
    assert result.json()["error"]["details"]["email_verified"] is True
    assert result.json()["error"]["details"]["retry_after"] > 0
    assert int(result.headers["retry-after"]) > 0


async def test_profile_retry_replaces_conversation_from_old_proxy_address(
    portal, engine
):
    client, _ = portal
    await client.post(
        "/api/v1/portal/login", json={"identifier": FORM["email"], "password": PASSWORD}
    )
    previous = client.cookies.get("clinic_portal_conversation")
    async with engine.begin() as connection:
        await connection.execute(
            text("UPDATE conversation_sessions SET client_ip='172.18.0.1'")
        )
        await connection.execute(text("""INSERT INTO rate_limit_events(bucket,subject)
            SELECT 'registration:ip','172.18.0.1' FROM generate_series(1,3)"""))
    result = await client.post(
        "/api/v1/portal/verify",
        json={"email": FORM["email"], "code": "000000", "registration": FORM},
    )
    assert result.status_code == 200, result.text
    assert client.cookies.get("clinic_portal_conversation") != previous


async def google_start(client):
    result = await client.post("/api/v1/portal/google", json={})
    assert result.status_code == 200, result.text
    url = urlsplit(result.json()["url"])
    assert url.scheme == "https" and url.netloc == "auth.example.test"
    assert url.path == "/auth/v1/authorize"
    query = parse_qs(url.query)
    assert query["provider"] == ["google"]
    assert query["code_challenge_method"] == ["s256"]
    redirect = urlsplit(query["redirect_to"][0])
    assert redirect.path == "/portal/auth.html"
    state = parse_qs(redirect.query)["oauth_state"][0]
    cookie = client.cookies.get("clinic_portal_google")
    verifier, cookie_state = cookie.split(".")
    assert cookie_state == state
    challenge = (
        base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest())
        .decode()
        .rstrip("=")
    )
    assert query["code_challenge"] == [challenge]
    assert "HttpOnly" in result.headers["set-cookie"]
    assert "SameSite=lax" in result.headers["set-cookie"]
    assert "Max-Age=600" in result.headers["set-cookie"]
    return state


async def test_google_pkce_first_login_and_existing_profile(portal):
    client, provider = portal
    state = await google_start(client)
    result = await client.post(
        "/api/v1/portal/google/exchange",
        json={"code": "synthetic-code", "state": state},
    )
    assert result.status_code == 409, result.text
    assert result.json()["error"]["details"]["email"] == FORM["email"]
    assert result.json()["error"]["details"]["email_verified"] is True
    assert client.cookies.get("clinic_portal_google") is None
    assert "synthetic-access" not in result.text
    assert any(
        path == "token?grant_type=pkce" and body["auth_code"] == "synthetic-code"
        for path, body, _ in provider.calls
    )
    completed = await client.post(
        "/api/v1/portal/verify",
        json={"email": FORM["email"], "code": "000000", "registration": FORM},
    )
    assert completed.status_code == 200, completed.text
    number = completed.json()["customer_number"]
    await client.post("/api/v1/portal/logout", json={})
    state = await google_start(client)
    result = await client.post(
        "/api/v1/portal/google/exchange", json={"code": "another-code", "state": state}
    )
    assert result.status_code == 200, result.text
    assert result.json()["customer_number"] == number
    assert (await client.get("/api/v1/portal/session")).status_code == 200


async def test_google_callback_requires_own_browser_state(portal):
    client, provider = portal
    result = await client.post(
        "/api/v1/portal/google/exchange",
        json={"code": "foreign-code", "state": "a" * 43},
    )
    assert result.status_code == 401
    assert not provider.calls
    state = await google_start(client)
    result = await client.post(
        "/api/v1/portal/google/exchange",
        json={"code": "foreign-code", "state": "b" * 43},
    )
    assert result.status_code == 401
    assert not provider.calls
    assert client.cookies.get("clinic_portal_google") is None
    assert (
        await client.post(
            "/api/v1/portal/google", json={}, headers={"Origin": "https://evil.example"}
        )
    ).status_code == 403
    assert (
        await client.post(
            "/api/v1/portal/google/exchange", json={"code": "code", "state": state}
        )
    ).status_code == 401


async def test_google_rejected_provider_code_clears_flow_without_session(portal):
    client, provider = portal
    state = await google_start(client)

    async def reject(path, **kwargs):
        raise APIError(401, "VERIFICATION_REQUIRED", "Invalid or expired code")

    provider.request = reject
    result = await client.post(
        "/api/v1/portal/google/exchange", json={"code": "expired-code", "state": state}
    )
    assert result.status_code == 401
    assert client.cookies.get("clinic_portal_google") is None
    assert client.cookies.get("clinic_portal_access") is None
    assert (await client.get("/api/v1/portal/session")).status_code == 401


@pytest.mark.parametrize("portal", [True], indirect=True)
@pytest.mark.parametrize("host", ["localhost", "127.0.0.1"])
@pytest.mark.parametrize("port", [5500, 5501, 8000, 8002])
async def test_google_and_recovery_use_local_frontend_origin(portal, host, port):
    client, provider = portal
    origin = f"http://{host}:{port}"
    client.base_url = f"http://{host}:8002"
    client.headers["Origin"] = origin
    preflight = await client.options(
        "/api/v1/portal/google",
        headers={
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type",
        },
    )
    assert preflight.status_code == 200
    assert preflight.headers["access-control-allow-origin"] == origin
    result = await client.post("/api/v1/portal/google", json={})
    assert result.status_code == 200, result.text
    assert "; Secure" not in result.headers["set-cookie"]
    query = parse_qs(urlsplit(result.json()["url"]).query)
    assert query["redirect_to"][0].startswith(
        origin + "/auth.html?"
        if port in [5500, 5501]
        else origin + "/portal/auth.html?"
    )
    state = parse_qs(urlsplit(query["redirect_to"][0]).query)["oauth_state"][0]
    result = await client.post(
        "/api/v1/portal/google/exchange",
        json={"code": "synthetic-local-code", "state": state},
    )
    assert result.status_code == 409, result.text
    assert "; Secure" not in result.headers["set-cookie"]
    assert client.cookies.get("clinic_portal_access") == "synthetic-access"
    result = await client.post(
        "/api/v1/portal/verify",
        json={"email": FORM["email"], "code": "000000", "registration": FORM},
    )
    assert result.status_code == 200, result.text
    assert (await client.get("/api/v1/portal/session")).status_code == 200
    assert (
        await client.post("/api/v1/portal/recover", json={"email": FORM["email"]})
    ).status_code == 202
    recover = next(path for path, _, _ in provider.calls if path.startswith("recover"))
    assert parse_qs(urlsplit(recover).query)["redirect_to"] == [
        origin + ("/auth.html" if port in [5500, 5501] else "/portal/auth.html")
    ]


@pytest.mark.parametrize("portal", [True], indirect=True)
async def test_loopback_header_cannot_downgrade_https_google_cookie(portal):
    client, _ = portal
    client.base_url = "https://clinic.example.test"
    client.headers["Origin"] = "http://localhost:5501"
    result = await client.post("/api/v1/portal/google", json={})
    assert result.status_code == 200
    assert "; Secure" in result.headers["set-cookie"]


async def test_google_rejects_arbitrary_callback_paths(portal):
    client, _ = portal
    for path in [
        "https://outside.example/auth.html",
        "//outside.example/auth.html",
        "/api/v1/admin/patients",
    ]:
        result = await client.post("/api/v1/portal/google", json={"return_path": path})
        assert result.status_code == 400


@pytest.mark.parametrize("portal", [True], indirect=True)
@pytest.mark.parametrize("host", ["localhost", "127.0.0.1"])
@pytest.mark.parametrize("frontend_port,backend_port", [(5500, 8000), (5501, 8002)])
async def test_local_password_otp_and_reset_round_trip(
    portal, host, frontend_port, backend_port
):
    client, _ = portal
    client.base_url = f"http://{host}:{backend_port}"
    client.headers["Origin"] = f"http://{host}:{frontend_port}"
    body = {**FORM, "password": PASSWORD, "password_confirm": PASSWORD}
    signup = await client.post("/api/v1/portal/signup", json=body)
    assert signup.status_code == 202, signup.text
    assert "; Secure" not in signup.headers["set-cookie"]
    assert (
        await client.post("/api/v1/portal/resend", json={"email": FORM["email"]})
    ).status_code == 202
    assert (
        await client.post(
            "/api/v1/portal/verify",
            json={"email": FORM["email"], "code": "123456", "registration": FORM},
        )
    ).status_code == 200
    assert (await client.get("/portal/portal-api.js")).status_code == 200
    for identifier in [FORM["email"], "01012345678"]:
        assert (await client.post("/api/v1/portal/logout", json={})).status_code == 204
        assert (
            await client.post(
                "/api/v1/portal/login",
                json={"identifier": identifier, "password": PASSWORD},
            )
        ).status_code == 200
        assert (await client.get("/api/v1/portal/session")).status_code == 200
    assert (
        await client.post(
            "/api/v1/portal/recover",
            json={"email": FORM["email"], "return_path": "/auth.html"},
        )
    ).status_code == 202
    assert (
        await client.post(
            "/api/v1/portal/recovery-session", json={"access_token": "synthetic-access"}
        )
    ).status_code == 204
    reset = await client.post(
        "/api/v1/portal/reset-password",
        json={
            "email": FORM["email"],
            "password": PASSWORD,
            "password_confirm": PASSWORD,
        },
    )
    assert reset.status_code == 204, reset.text
    assert (await client.get("/api/v1/portal/session")).status_code == 401
