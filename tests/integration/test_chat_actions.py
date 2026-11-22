"""Exercise signed chat actions against a disposable database and synthetic auth."""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from clinic_backend.seed import seed_catalog
from sqlalchemy import text

from tests.integration.conftest import ROOT
from tests.integration.test_identity import FORM
from tests.integration.test_portal_auth import portal as portal_fixture

portal = portal_fixture


async def test_chat_booking_change_cancel_and_duplicate_confirmation(portal, engine):
    client, _ = portal
    await seed_catalog(engine, ROOT / "database/seed/catalog.json")
    async with engine.begin() as connection:
        await connection.execute(
            text(
                "UPDATE doctors SET working_days=ARRAY[1,2,3,4,6,7]::smallint[],"
                "shift_start='09:00',shift_end='17:00'"
            )
        )
    verified = await client.post(
        "/api/v1/portal/verify",
        json={
            "email": FORM["email"],
            "code": "123456",
            "registration": FORM,
        },
    )
    assert verified.status_code == 200, verified.text
    stale = await client.post(
        "/api/v1/portal/chat/message",
        json={
            "messages": [{"role": "user", "content": "Yes, please proceed."}],
            "confirmation_id": "0" * 64,
        },
    )
    assert stale.status_code == 409, stale.text
    assert stale.json()["error"]["code"] == "PROPOSAL_REPLACED"
    target = datetime.now(ZoneInfo("Africa/Cairo")).date() + timedelta(days=3)
    if target.isoweekday() == 5:
        target += timedelta(days=1)
    day = target.isoformat()
    proposal = await client.post(
        "/api/v1/portal/chat/propose-booking",
        json={
            "doctor_id": 1,
            "date": day,
            "start_time": "10:00",
        },
    )
    assert proposal.status_code == 200, proposal.text
    assert proposal.json()["selection"]["doctor"]["id"] == 1
    assert proposal.json()["reserved"] is False
    before = await client.get("/api/v1/portal/appointments")
    assert before.status_code == 200, before.text
    assert not before.json()["appointments"]
    confirmation = {"proposal": proposal.json()["proposal"]}
    saved = await client.post("/api/v1/portal/chat/confirm-booking", json=confirmation)
    assert saved.status_code == 200, saved.text
    retry = await client.post("/api/v1/portal/chat/confirm-booking", json=confirmation)
    assert retry.json() == saved.json()
    ident = saved.json()["appointment"]["id"]
    for operation, extra in [
        ("reschedule", {"date": day, "start_time": "11:00"}),
        ("cancel", {"reason": "Synthetic test"}),
    ]:
        change = await client.post(
            "/api/v1/portal/chat/propose-change",
            json={
                "operation": operation,
                "appointment_id": ident,
                **extra,
            },
        )
        assert change.status_code == 200, change.text
        result = await client.post(
            "/api/v1/portal/chat/confirm-booking",
            json={
                "proposal": change.json()["proposal"],
            },
        )
        assert result.status_code == 200, result.text
        assert result.json()["saved"] is True
        assert result.json()["operation"] == operation
        if operation == "reschedule":
            other = await client.post(
                "/api/v1/portal/chat/propose-booking",
                json={"doctor_id": 2, "date": day, "start_time": "10:00"},
            )
            assert other.status_code == 200, other.text
            saved_other = await client.post(
                "/api/v1/portal/chat/confirm-booking",
                json={"proposal": other.json()["proposal"]},
            )
            assert saved_other.status_code == 200, saved_other.text
            conflict = await client.post(
                "/api/v1/portal/chat/propose-change",
                json={
                    "operation": "reschedule",
                    "appointment_id": ident,
                    "date": day,
                    "start_time": "10:00",
                },
            )
            assert conflict.status_code == 409, conflict.text
            assert conflict.json()["error"]["code"] == "PATIENT_SLOT_CONFLICT"
            assert conflict.json()["error"]["details"]["doctor"]
            assert conflict.json()["error"]["details"]["start_time"] == "10:00"


async def test_chat_action_requires_authenticated_patient(portal):
    client, _ = portal
    response = await client.post(
        "/api/v1/portal/chat/confirm-booking",
        json={
            "proposal": "invalid-synthetic-proposal",
        },
    )
    assert response.status_code == 401
