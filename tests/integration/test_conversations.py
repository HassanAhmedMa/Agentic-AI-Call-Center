import asyncio
import hashlib
from datetime import UTC, datetime, timedelta

import httpx
import pytest
from clinic_backend.app import create_app
from clinic_backend.settings import Settings
from sqlalchemy import text

SERVICE = "synthetic-service-token-for-tests-only-123456789"


@pytest.fixture
async def client(engine):
    settings = Settings(
        database_url="postgresql+asyncpg://unused:unused@localhost/unused",
        agent_service_token=SERVICE,
    )
    app = create_app(settings, engine=engine)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        yield client


async def start(client):
    response = await client.post("/api/v1/conversations", json={"channel": "text"})
    assert response.status_code == 201, response.text
    return response.json()["conversation_token"]


async def event(client, token, value, service=SERVICE):
    headers = {"X-Conversation-Token": token}
    if service is not None:
        headers["X-Service-Token"] = service
    return await client.post(
        "/api/v1/conversations/current/events", headers=headers, json={"event": value}
    )


async def test_token_is_random_and_only_hash_is_stored(client, engine):
    token = await start(client)
    other = await start(client)
    assert token != other and len(token) >= 43
    async with engine.connect() as conn:
        row = (
            (await conn.execute(text("SELECT * FROM conversation_sessions LIMIT 1")))
            .mappings()
            .one()
        )
    assert row["token_hash"] == hashlib.sha256(token.encode()).digest()
    assert token not in str(dict(row))
    assert row["status"] == "active" and row["channel"] == "text"


async def test_service_auth_precedes_conversation_and_body_validation(client):
    for service in [None, "wrong"]:
        response = await event(client, "unknown", "invalid", service)
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "SERVICE_AUTH_REQUIRED"
    response = await event(client, "unknown", "ended")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "CONVERSATION_INVALID"


async def test_lifecycle_and_repeated_disconnect(client, engine):
    token = await start(client)
    assert (await event(client, token, "disconnected")).status_code == 204
    async with engine.connect() as conn:
        original = await conn.scalar(
            text("SELECT disconnected_at FROM conversation_sessions")
        )
    assert (await event(client, token, "disconnected")).status_code == 204
    async with engine.connect() as conn:
        assert (
            await conn.scalar(text("SELECT disconnected_at FROM conversation_sessions"))
            == original
        )
    assert (await event(client, token, "reconnected")).status_code == 204
    assert (await event(client, token, "ended")).status_code == 204
    assert (await event(client, token, "reconnected")).status_code == 401


async def test_expiry_is_persisted_even_when_request_rejected(client, engine):
    token = await start(client)
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "UPDATE conversation_sessions SET status='disconnected', "
                "disconnected_at=:at"
            ),
            {"at": datetime.now(UTC) - timedelta(seconds=301)},
        )
    assert (await event(client, token, "reconnected")).status_code == 401
    async with engine.connect() as conn:
        row = (
            await conn.execute(
                text("SELECT status, ended_at FROM conversation_sessions")
            )
        ).one()
    assert row.status == "ended" and row.ended_at is not None


async def test_creation_limit_is_atomic_across_concurrent_requests(client, engine):
    results = await asyncio.gather(
        *[
            client.post("/api/v1/conversations", json={"channel": "voice"})
            for _ in range(14)
        ]
    )
    assert sum(r.status_code == 201 for r in results) == 10
    limited = [r for r in results if r.status_code == 429]
    assert len(limited) == 4 and all(int(r.headers["Retry-After"]) > 0 for r in limited)
    async with engine.connect() as conn:
        assert (
            await conn.scalar(text("SELECT count(*) FROM conversation_sessions")) == 10
        )


async def test_strict_body_and_no_query_parameters(client):
    for body in [{"channel": "other"}, {"channel": "text", "secret": "hidden"}, {}]:
        response = await client.post("/api/v1/conversations", json=body)
        assert response.status_code == 400 and "hidden" not in response.text
    response = await client.post(
        "/api/v1/conversations?token=hidden", json={"channel": "text"}
    )
    assert response.status_code == 400 and "hidden" not in response.text


async def test_forwarded_ip_cannot_bypass_limit(client):
    for index in range(10):
        response = await client.post(
            "/api/v1/conversations",
            json={"channel": "text"},
            headers={"X-Forwarded-For": f"192.0.2.{index}"},
        )
        assert response.status_code == 201
    assert (
        await client.post("/api/v1/conversations", json={"channel": "text"})
    ).status_code == 429


async def test_disconnect_window_starts_after_lock_wait(client, engine, monkeypatch):
    import clinic_backend.conversations as module

    token = await start(client)
    lookup_started = asyncio.Event()
    original = module.find_conversation

    async def observed_lookup(*args):
        lookup_started.set()
        return await original(*args)

    monkeypatch.setattr(module, "find_conversation", observed_lookup)
    async with engine.connect() as conn:
        transaction = await conn.begin()
        await conn.execute(text("SELECT id FROM conversation_sessions FOR UPDATE"))
        task = asyncio.create_task(event(client, token, "disconnected"))
        await asyncio.wait_for(lookup_started.wait(), timeout=5)
        released_at = datetime.now(UTC)
        await transaction.commit()
    assert (await asyncio.wait_for(task, timeout=5)).status_code == 204
    async with engine.connect() as conn:
        at = await conn.scalar(
            text("SELECT disconnected_at FROM conversation_sessions")
        )
    assert at >= released_at
