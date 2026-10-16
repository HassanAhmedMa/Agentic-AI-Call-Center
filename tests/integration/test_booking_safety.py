import asyncio
import hashlib
import json
from datetime import date, time, timedelta

import httpx
from clinic_backend.app import create_app
from clinic_backend.bookings import Bookings
from clinic_backend.seed import seed_catalog
from clinic_backend.settings import Settings
from clinic_backend.slot_rules import slot_instant
from clinic_schemas.bookings import Book
from sqlalchemy import text

from tests.integration.conftest import ROOT
from tests.integration.test_identity import SECRET, SERVICE


async def test_conflicts_limits_ownership_and_atomic_changes(engine, monkeypatch):
    await seed_catalog(engine, ROOT / "database/seed/catalog.json")
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "UPDATE doctors SET working_days=ARRAY[1,2,3,4,6,7]::smallint[],"
                "shift_start='09:00',shift_end='17:00'"
            )
        )
    current_time = [slot_instant(date(2026, 10, 17), time(8))]
    app = create_app(
        Settings(
            database_url="postgresql+asyncpg://unused@localhost/unused",
            identity_enabled=True,
            agent_service_token=SERVICE,
            otp_hmac_secret=SECRET,
        ),
        engine=engine,
        clock=lambda: current_time[0],
    )
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        headers = []
        patient_ids = []
        for i in range(2):
            token = (
                await client.post("/api/v1/conversations", json={"channel": "text"})
            ).json()["conversation_token"]
            async with engine.begin() as conn:
                pid = await conn.scalar(
                    text("""INSERT INTO patients(customer_number,
                    full_name,email,email_verified_at,phone,date_of_birth)
                    VALUES (:number,'Synthetic',:email,now(),'+201000000001',
                    '1988-01-01') RETURNING id"""),
                    {"number": f"{i:06d}", "email": f"patient{i}@example.test"},
                )
                patient_ids.append(pid)
                await conn.execute(
                    text("""INSERT INTO patient_sessions(patient_id,
                    conversation_session_id,expires_at) SELECT :pid,id,
                    now()+interval '1 hour' FROM conversation_sessions
                    WHERE token_hash=:hash"""),
                    {"pid": pid, "hash": hashlib.sha256(token.encode()).digest()},
                )
            headers.append({"X-Conversation-Token": token, "X-Service-Token": SERVICE})
        path = "/api/v1/patients/me/appointments"

        async def book(h, key, day="2026-10-18", doctor=1, clock="10:00"):
            return await client.post(
                path,
                headers={**h, "Idempotency-Key": key},
                json={"doctor_id": doctor, "date": day, "start_time": clock},
            )

        race = await asyncio.gather(book(headers[0], "race"), book(headers[1], "race"))
        assert sorted(r.status_code for r in race) == [201, 409]
        winner = 0 if race[0].status_code == 201 else 1
        h = headers[winner]
        other = headers[1 - winner]
        ident = race[winner].json()["id"]
        assert race[1 - winner].json()["error"]["code"] == "SLOT_UNAVAILABLE"
        assert (await client.get(f"{path}/{ident}", headers=other)).status_code == 404
        missing = await client.post(
            path,
            headers=h,
            json={"doctor_id": 1, "date": "2026-10-18", "start_time": "12:00"},
        )
        assert missing.json()["error"]["code"] == "IDEMPOTENCY_KEY_REQUIRED"
        assert (await book(h, "grid", clock="10:15")).json()["error"][
            "code"
        ] == "INVALID_SLOT_TIME"
        assert (await book(h, "friday", "2026-10-23")).json()["error"][
            "code"
        ] == "CLINIC_CLOSED"
        assert (await book(h, "duplicate", clock="12:00")).json()["error"][
            "code"
        ] == "DUPLICATE_DOCTOR_SAME_DAY"
        assert (await book(h, "second", doctor=2, clock="11:00")).status_code == 201
        assert (await book(h, "daily", doctor=3, clock="12:00")).json()["error"][
            "code"
        ] == "DAILY_LIMIT_REACHED"
        for i, day in enumerate(["2026-10-19", "2026-10-20", "2026-10-21"]):
            assert (await book(h, "active" + str(i), day)).status_code == 201
        assert (await book(h, "sixth", "2026-10-22", doctor=2)).json()["error"][
            "code"
        ] == "ACTIVE_LIMIT_REACHED"
        moved = await client.post(
            f"{path}/{ident}/reschedule",
            headers={**h, "Idempotency-Key": "move-at-five"},
            json={"date": "2026-10-18", "start_time": "12:00"},
        )
        assert moved.status_code == 200, moved.text
        rejected = await client.post(
            f"{path}/{ident}/reschedule",
            headers={**h, "Idempotency-Key": "bad-move"},
            json={"date": "2026-10-19", "start_time": "10:00"},
        )
        assert rejected.status_code == 409
        assert (await client.get(f"{path}/{ident}", headers=h)).json()[
            "start_time"
        ] == "12:00"
        assert (
            await book(other, "too-late", "2026-10-17", doctor=4, clock="09:00")
        ).status_code == 201
        cutoff = await book(other, "cutoff", "2026-10-17", doctor=5, clock="12:00")
        assert cutoff.status_code == 201, cutoff.text
        cutoff_id = cutoff.json()["id"]
        exact = await client.post(
            f"{path}/{cutoff_id}/cancel",
            headers={**other, "Idempotency-Key": "exact-four"},
            json={},
        )
        assert exact.status_code == 200
        upcoming = (await client.get(path, headers=other)).json()["appointments"]
        close_id = next(
            item["id"] for item in upcoming if item["start_time"] == "09:00"
        )
        closed = await client.post(
            f"{path}/{close_id}/cancel",
            headers={**other, "Idempotency-Key": "inside-four"},
            json={},
        )
        assert closed.json()["error"]["code"] == "CHANGE_WINDOW_CLOSED"
        payload = {"doctor_id": 2, "date": "2026-10-22", "start_time": "12:00"}
        fingerprint = hashlib.sha256(
            json.dumps(
                {
                    "operation": "book_appointment",
                    "target": None,
                    "body": Book.model_validate(payload).model_dump(mode="json"),
                },
                sort_keys=True,
                separators=(",", ":"),
            ).encode()
        ).digest()
        async with engine.begin() as conn:
            await conn.execute(
                text("""INSERT INTO idempotency_keys(patient_id,
              operation,idempotency_key,request_hash,expires_at)
              VALUES (:p,'book_appointment','pending',:h,'2026-10-18')"""),
                {"p": patient_ids[winner], "h": fingerprint},
            )
        pending = await client.post(
            path, headers={**h, "Idempotency-Key": "pending"}, json=payload
        )
        assert pending.json()["error"]["code"] == "IDEMPOTENCY_IN_PROGRESS"
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    "UPDATE idempotency_keys SET expires_at='2026-10-01' "
                    "WHERE idempotency_key='pending'"
                )
            )
        expired = await client.post(
            path, headers={**h, "Idempotency-Key": "pending"}, json=payload
        )
        assert expired.json()["error"]["code"] == "ACTIVE_LIMIT_REACHED"
        assert (
            await client.post(
                path, headers={**h, "Idempotency-Key": "pending"}, json=payload
            )
        ).json() == expired.json()
        boundary = await book(other, "boundary", "2026-10-17", doctor=5, clock="12:00")
        assert boundary.status_code == 201
        waiting = asyncio.Event()
        original = Bookings.lock_patient

        async def observed_lock(self):
            waiting.set()
            await original(self)

        monkeypatch.setattr(Bookings, "lock_patient", observed_lock)
        async with engine.begin() as conn:
            await conn.execute(
                text("SELECT id FROM patients WHERE id=:p FOR NO KEY UPDATE"),
                {"p": patient_ids[1 - winner]},
            )
            request = asyncio.create_task(
                client.post(
                    f"{path}/{boundary.json()['id']}/cancel",
                    headers={**other, "Idempotency-Key": "waited-cutoff"},
                    json={},
                )
            )
            await asyncio.wait_for(waiting.wait(), 5)
            current_time[0] += timedelta(seconds=1)
        after_wait = await request
        assert after_wait.json()["error"]["code"] == "CHANGE_WINDOW_CLOSED"
