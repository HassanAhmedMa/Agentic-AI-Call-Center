from datetime import date, time

import httpx
from clinic_backend.app import create_app
from clinic_backend.seed import seed_catalog
from clinic_backend.settings import Settings
from clinic_backend.slot_rules import slot_instant
from sqlalchemy import text

from tests.integration.conftest import ROOT
from tests.integration.test_identity import (
    FORM,
    SECRET,
    SERVICE,
    Inbox,
    register,
    verify,
)


async def test_booking_idempotency_reschedule_and_cancel(engine):
    await seed_catalog(engine, ROOT / "database/seed/catalog.json")
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "UPDATE doctors SET working_days=ARRAY[1,2,3,4,6,7]::smallint[],"
                "shift_start='09:00',shift_end='17:00'"
            )
        )
    inbox = Inbox()
    app = create_app(
        Settings(
            database_url="postgresql+asyncpg://unused@localhost/unused",
            identity_enabled=True,
            agent_service_token=SERVICE,
            otp_hmac_secret=SECRET,
        ),
        engine=engine,
        mailer=inbox,
        clock=lambda: slot_instant(date(2026, 10, 17), time(8)),
    )
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        token = (
            await client.post("/api/v1/conversations", json={"channel": "text"})
        ).json()["conversation_token"]
        browser = {"X-Conversation-Token": token}
        await register(client, browser, FORM)
        assert (await verify(client, browser, inbox.code())).status_code == 200
        headers = {**browser, "X-Service-Token": SERVICE, "Idempotency-Key": "book-one"}
        body = {
            "doctor_id": 1,
            "date": "2026-10-18",
            "start_time": "10:00",
            "visit_reason": "Synthetic follow-up",
        }
        first = await client.post(
            "/api/v1/patients/me/appointments", headers=headers, json=body
        )
        assert first.status_code == 201, first.text
        assert (
            await client.post(
                "/api/v1/patients/me/appointments", headers=headers, json=body
            )
        ).json() == first.json()
        different = await client.post(
            "/api/v1/patients/me/appointments",
            headers=headers,
            json={**body, "start_time": "11:00"},
        )
        assert (
            different.status_code == 422
            and different.json()["error"]["code"] == "IDEMPOTENCY_KEY_REUSED"
        )
        ident = first.json()["id"]
        moved = await client.post(
            f"/api/v1/patients/me/appointments/{ident}/reschedule",
            headers={**headers, "Idempotency-Key": "move-one"},
            json={"date": "2026-10-19", "start_time": "12:00"},
        )
        assert moved.status_code == 200, moved.text
        assert moved.json()["previous"]["start_time"] == "10:00"
        listed = await client.get("/api/v1/patients/me/appointments", headers=headers)
        assert listed.status_code == 200 and listed.json()["total"] == 1
        cancelled = await client.post(
            f"/api/v1/patients/me/appointments/{ident}/cancel",
            headers={**headers, "Idempotency-Key": "cancel-one"},
            json={"reason": "Synthetic change"},
        )
        assert cancelled.status_code == 200, cancelled.text
        assert (
            await client.post(
                f"/api/v1/patients/me/appointments/{ident}/cancel",
                headers={**headers, "Idempotency-Key": "cancel-one"},
                json={"reason": "Synthetic change"},
            )
        ).json() == cancelled.json()
        async with engine.connect() as conn:
            assert await conn.scalar(text("SELECT count(*) FROM appointments")) == 1
            assert (
                await conn.scalar(text("SELECT count(*) FROM appointment_history")) == 3
            )
