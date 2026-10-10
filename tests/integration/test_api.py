from pathlib import Path

import pytest
from clinic_backend.app import create_app
from clinic_backend.seed import seed_catalog
from clinic_backend.settings import Settings
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

ROOT = Path(__file__).resolve().parents[2]


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/doctors/9223372036854775808",
        "/api/v1/services/9223372036854775808",
        "/api/v1/doctors?specialty_id=9223372036854775808",
        "/api/v1/services?offset=9223372036854775808",
        "/api/v1/doctors?offset=9223372036854775808",
        "/api/v1/doctors?q=%00",
        "/api/v1/services?category=%00",
    ],
)
async def test_unrepresentable_database_inputs_are_validation_errors(
    engine: AsyncEngine, path: str
) -> None:
    app = create_app(
        Settings(database_url="postgresql+asyncpg://unused@localhost/unused"),
        engine=engine,
    )
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as http:
        response = await http.get(path)
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "VALIDATION_FAILED"
        assert response.json()["error"]["details"]["fields"]


async def test_http_catalog_on_real_postgres(engine: AsyncEngine) -> None:
    await seed_catalog(engine, ROOT / "database/seed/catalog.json")
    app = create_app(
        Settings(database_url="postgresql+asyncpg://unused@localhost/unused"),
        engine=engine,
    )
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as http:
        assert (await http.get("/api/v1/health/ready")).json() == {"status": "ready"}
        assert (await http.get("/api/v1/specialties")).json()["total"] == 5
        response = await http.get("/api/v1/doctors", params={"q": "قَلْب", "limit": 1})
        assert response.status_code == 200
        assert response.json()["total"] == 2
        assert response.json()["doctors"][0]["name_ar"] == "د. أمل نور"
        assert (await http.get("/api/v1/doctors/1")).json()["bio_ar"] is not None
        assert (await http.get("/api/v1/services/2")).json()["price"] == {
            "amount": 600.0,
            "currency": "EGP",
        }
        for path, code in [
            ("/api/v1/doctors/999", "DOCTOR_NOT_FOUND"),
            ("/api/v1/services/999", "SERVICE_NOT_FOUND"),
        ]:
            response = await http.get(path)
            assert response.status_code == 404
            assert response.json()["error"]["code"] == code
        assert (await http.get("/api/v1/services?category=laboratory&limit=2")).json()[
            "total"
        ] == 7
        assert (await http.get("/api/v1/availability/search")).status_code == 404
        async with engine.begin() as conn:
            await conn.execute(
                text("UPDATE alembic_version SET version_num='old_revision'")
            )
        assert (await http.get("/api/v1/health/ready")).status_code == 503
