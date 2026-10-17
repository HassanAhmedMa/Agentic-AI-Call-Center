from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from clinic_backend.catalog import Catalog
from clinic_backend.seed import seed_catalog
from clinic_schemas.catalog import DoctorQuery, ServiceQuery
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker

ROOT = Path(__file__).resolve().parents[2]


async def test_seed_is_idempotent_and_bilingual_search(engine: AsyncEngine) -> None:
    await seed_catalog(engine, ROOT / "database/seed/catalog.json")
    await seed_catalog(engine, ROOT / "database/seed/catalog.json")
    async with async_sessionmaker(engine)() as session:
        catalog = Catalog(session)
        assert (await catalog.specialties()).total == 5
        assert (await catalog.doctors(DoctorQuery())).total == 10
        assert (await catalog.services(ServiceQuery())).total == 15
        for term in ["قَلْب", "cardio", "heart", "قلب"]:
            result = await catalog.doctors(DoctorQuery(q=term))
            assert [d.id for d in result.doctors] == [1, 2]
        assert (await catalog.doctors(DoctorQuery(q="باطنة"))).total == 2
        assert (await catalog.doctors(DoctorQuery(q="نسا"))).total == 0
        assert (await catalog.doctors(DoctorQuery(q="أَمَل"))).doctors[0].id == 1
        for term in ["%", "_", "' OR 1=1 --"]:
            assert (await catalog.doctors(DoctorQuery(q=term))).total == 0
        page = await catalog.doctors(DoctorQuery(specialty_id=1, limit=1, offset=1))
        assert page.total == 2
        assert [d.id for d in page.doctors] == [2]
        detail = await catalog.doctor(1)
        assert detail is not None
        assert detail.working_hours.start == "09:00"
        assert "friday" not in detail.working_days
        assert detail.consultation_fee.amount == 350
        assert (await catalog.services(ServiceQuery(category="laboratory"))).total == 7
        assert (await catalog.services(ServiceQuery(offset=100))).services == []


async def test_inactive_resources_are_hidden(engine: AsyncEngine) -> None:
    await seed_catalog(engine, ROOT / "database/seed/catalog.json")
    async with engine.begin() as conn:
        await conn.execute(text("UPDATE doctors SET is_active=false WHERE id=1"))
        await conn.execute(text("UPDATE services SET is_available=false WHERE id=1"))
    async with async_sessionmaker(engine)() as session:
        catalog = Catalog(session)
        assert await catalog.doctor(1) is None
        assert await catalog.service(1) is None
        assert (await catalog.doctors(DoctorQuery())).total == 9
        assert (await catalog.services(ServiceQuery())).total == 14


@pytest.mark.parametrize(
    "assignment",
    [
        "consultation_fee=-1",
        "working_days=ARRAY[5]::smallint[]",
        "working_days=ARRAY[]::smallint[]",
        "shift_start='06:00'",
        "shift_end='23:00'",
        "shift_start='09:15'",
        "shift_end='08:00'",
        "working_days=ARRAY[1,NULL]::smallint[]",
    ],
)
async def test_doctor_constraints(engine: AsyncEngine, assignment: str) -> None:
    await seed_catalog(engine, ROOT / "database/seed/catalog.json")
    with pytest.raises(IntegrityError):
        async with engine.begin() as conn:
            await conn.execute(text("UPDATE doctors SET " + assignment + " WHERE id=1"))


@pytest.mark.parametrize("assignment", ["price=-1", "duration_minutes=0"])
async def test_service_constraints(engine: AsyncEngine, assignment: str) -> None:
    await seed_catalog(engine, ROOT / "database/seed/catalog.json")
    with pytest.raises(IntegrityError):
        async with engine.begin() as conn:
            await conn.execute(
                text("UPDATE services SET " + assignment + " WHERE id=1")
            )


async def test_migration_can_downgrade_and_upgrade(engine: AsyncEngine) -> None:
    async with engine.begin() as conn:

        def migrate(connection):
            config = Config(str(ROOT / "alembic.ini"))
            config.attributes["connection"] = connection
            command.downgrade(config, "base")
            command.upgrade(config, "head")

        await conn.run_sync(migrate)
    await seed_catalog(engine, ROOT / "database/seed/catalog.json")
    async with engine.connect() as conn:
        assert (await conn.execute(text("SELECT count(*) FROM doctors"))).scalar() == 10
