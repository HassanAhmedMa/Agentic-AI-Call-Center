from datetime import date, time

from clinic_backend.app import create_app
from clinic_backend.seed import seed_catalog
from clinic_backend.settings import Settings
from clinic_backend.slot_rules import slot_instant
from fastapi.testclient import TestClient
from sqlalchemy import text

from tests.integration.conftest import ROOT


async def test_public_availability(engine):
    await seed_catalog(engine, ROOT / "database/seed/catalog.json")
    async with engine.begin() as conn:
        await conn.execute(
            text("UPDATE doctors SET working_days=ARRAY[1,2,3,4,6,7]::smallint[]")
        )
    settings = Settings(
        database_url="postgresql+asyncpg://test:test@localhost/test",
        public_rate_limit=1000,
    )
    app = create_app(
        settings, engine=engine, clock=lambda: slot_instant(date(2026, 10, 15), time(8))
    )
    with TestClient(app) as client:
        response = client.get("/api/v1/doctors/1/availability?from_date=2026-10-15")
        assert response.status_code == 200, response.text
        assert response.json()["days"][0]["slots"]
        for suffix in [
            "from_date=20261015",
            "from_date=2026-10-15&to_date=2026-10-22",
            "from_date=2026-10-15&extra=1",
            "from_date=2026-10-15&from_date=2026-10-16",
        ]:
            assert (
                client.get("/api/v1/doctors/1/availability?" + suffix).status_code
                == 400
            )
        assert (
            client.get(
                "/api/v1/doctors/999/availability?from_date=2026-10-15"
            ).status_code
            == 404
        )
        friday = client.get(
            "/api/v1/doctors/1/availability?from_date=2026-10-16"
        ).json()
        assert friday["days"][0]["reason"] == "CLINIC_CLOSED"
        result = client.get(
            "/api/v1/availability/search?from_date=2026-10-15&earliest_time=10:00&latest_time=11:00&limit=20"
        )
        assert result.status_code == 200, result.text
        rows = result.json()["results"]
        assert rows and all("name_ar" in row["doctor"] for row in rows)
        assert all("10:00" <= row["start_time"] < "11:00" for row in rows)
        assert [(row["start_time"], row["doctor"]["id"]) for row in rows] == sorted(
            (row["start_time"], row["doctor"]["id"]) for row in rows
        )
        limited = client.get(
            "/api/v1/availability/search?from_date=2026-10-15&earliest_time=10:00&latest_time=11:00&limit=1"
        ).json()["results"]
        assert limited == rows[:1]
    async with engine.begin() as conn:
        await conn.execute(text("""INSERT INTO patients(customer_number,full_name,
            email,email_verified_at,phone,date_of_birth) VALUES
            ('000000','Synthetic','synthetic@example.test',now(),
            '+201000000001','1988-01-01')"""))
        await conn.execute(text("""INSERT INTO appointments(patient_id,doctor_id,
            appointment_date,start_time,end_time,visit_reason)
            SELECT id,1,'2026-10-15','10:00','10:30','PRIVATE TEST' FROM patients"""))
        await conn.execute(text("""INSERT INTO doctor_time_off(doctor_id,off_date,
            start_time,end_time,reason)
            VALUES (1,'2026-10-15','12:00','13:00','PRIVATE LEAVE')"""))
    with TestClient(app) as client:
        response = client.get("/api/v1/doctors/1/availability?from_date=2026-10-15")
        slots = response.json()["days"][0]["slots"]
        assert "10:00" not in slots and "12:00" not in slots
        assert "PRIVATE" not in response.text and "synthetic@" not in response.text
        assert client.get(
            "/api/v1/availability/search?from_date=2026-10-15&doctor_id=1&specialty_id=2"
        ).json() == {"results": []}
        assert (
            client.get(
                "/api/v1/doctors/1/availability?from_date=9999-12-31"
            ).status_code
            == 200
        )
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "UPDATE appointments SET status='cancelled',"
                "cancelled_at=now(),cancelled_by='patient'"
            )
        )
    with TestClient(app) as client:
        assert (
            "10:00"
            in client.get("/api/v1/doctors/1/availability?from_date=2026-10-15").json()[
                "days"
            ][0]["slots"]
        )
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "INSERT INTO clinic_closures(closure_date,reason_en,reason_ar) "
                "VALUES ('2026-10-15','Synthetic closure','إغلاق تجريبي')"
            )
        )
    with TestClient(app) as client:
        assert (
            client.get("/api/v1/doctors/1/availability?from_date=2026-10-15").json()[
                "days"
            ][0]["reason"]
            == "CLINIC_CLOSED"
        )
        assert client.get(
            "/api/v1/availability/search?from_date=2026-10-15"
        ).json() == {"results": []}
    async with engine.begin() as conn:
        await conn.execute(text("UPDATE doctors SET is_active=false WHERE id=1"))
    with TestClient(app) as client:
        assert (
            client.get(
                "/api/v1/doctors/1/availability?from_date=2026-10-15"
            ).status_code
            == 404
        )
