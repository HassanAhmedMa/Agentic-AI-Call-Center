from datetime import date

from clinic_backend.seed import seed_catalog, seed_scheduling
from sqlalchemy import text

from tests.integration.conftest import ROOT


async def test_opt_in_schedule_seed_is_repeatable(engine):
    await seed_catalog(engine, ROOT / "database/seed/catalog.json")
    path = ROOT / "database/seed/scheduling.json"
    await seed_scheduling(engine, path, date(2026, 10, 14))
    await seed_scheduling(engine, path, date(2026, 10, 14))
    async with engine.connect() as conn:
        assert await conn.scalar(text("SELECT count(*) FROM clinic_closures")) == 1
        assert await conn.scalar(text("SELECT count(*) FROM doctor_time_off")) == 2
        assert await conn.scalar(text("SELECT count(*) FROM appointments")) == 0
