import base64
import json
import threading
from datetime import UTC, datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from uuid import uuid4

import pytest
from clinic_backend.errors import APIError
from clinic_backend.settings import Settings
from clinic_backend.supabase_auth import AuthClient


def settings():
    return Settings(
        database_url="postgresql+asyncpg://unused@localhost/unused",
        supabase_url="https://auth.example.test",
        supabase_public_key="public-test-key",
    )


def token(user, session, **overrides):
    claims = dict(
        sub=str(user),
        session_id=str(session),
        aud="authenticated",
        iss="https://auth.example.test/auth/v1",
        exp=(datetime.now(UTC) + timedelta(hours=1)).timestamp(),
    )
    claims.update(overrides)
    payload = base64.urlsafe_b64encode(json.dumps(claims).encode()).decode().rstrip("=")
    return "header." + payload + ".signature"


async def test_authoritative_user_checked_before_claims(monkeypatch):
    user, session = uuid4(), uuid4()
    client = AuthClient(settings())

    async def request(*args, **kwargs):
        return dict(
            id=str(user),
            email="patient@example.test",
            email_confirmed_at="2026-10-01T00:00:00Z",
            is_anonymous=False,
        )

    monkeypatch.setattr(client, "request", request)
    result = await client.verify_access_token(token(user, session))
    assert result.user_id == user and result.session_id == session
    for invalid in [
        token(uuid4(), session),
        token(user, session, exp=0),
        token(user, session, aud="service_role"),
        token(user, session, iss="https://other.test"),
        "bad",
    ]:
        with pytest.raises(APIError):
            await client.verify_access_token(invalid)


async def test_unverified_email_rejected(monkeypatch):
    client = AuthClient(settings())
    user, session = uuid4(), uuid4()

    async def request(*args, **kwargs):
        return dict(id=str(user), email="patient@example.test", email_confirmed_at=None)

    monkeypatch.setattr(client, "request", request)
    with pytest.raises(APIError):
        await client.verify_access_token(token(user, session))


@pytest.mark.parametrize(
    "status,body,expected",
    [
        (401, b"{}", 401),
        (429, b"{}", 429),
        (503, b"{}", 503),
        (302, b"{}", 503),
        (200, b"<html>failure</html>", 503),
        (200, b"[]", 503),
        (200, b"x" * 131073, 503),
    ],
    ids=[
        "unauthorized",
        "limited",
        "unavailable",
        "redirect",
        "html",
        "array",
        "oversize",
    ],
)
async def test_http_transport_sanitizes_failures(status, body, expected):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_GET(self):
            self.send_response(status)
            self.send_header("Location", "http://127.0.0.1:1/private")
            self.end_headers()
            self.wfile.write(body)

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        client = AuthClient(
            Settings(
                database_url="postgresql+asyncpg://unused@localhost/unused",
                environment="test",
                supabase_url=f"http://127.0.0.1:{server.server_port}",
                supabase_public_key="test-public-key",
            )
        )
        with pytest.raises(APIError) as caught:
            await client.request("user", token="synthetic-private-token")
        assert caught.value.status == expected
        assert "synthetic-private-token" not in caught.value.message
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)
