import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import text

from tests.integration.conftest import ROOT


async def test_private_runtime_permissions_and_upgrade_preserves_rows(engine):
    # Everything, including newly created roles, is rolled back. Never alter an
    # existing clinic schema or runtime role in a developer's database.
    async with engine.connect() as conn:
        transaction = await conn.begin()
        try:
            if await conn.scalar(text("SELECT to_regnamespace('clinic')")):
                pytest.skip("Dedicated private schema already exists")
            if await conn.scalar(
                text("SELECT 1 FROM pg_roles WHERE rolname='clinic_runtime'")
            ):
                pytest.skip("Use an isolated cluster for fixed runtime-role test")
            await conn.execute(
                text("CREATE ROLE clinic_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS")
            )
            await conn.execute(text("CREATE SCHEMA clinic"))
            await conn.execute(text("SET LOCAL search_path TO clinic"))

            def migrate(connection, revision):
                config = Config(str(ROOT / "alembic.ini"))
                config.attributes["connection"] = connection
                command.upgrade(config, revision)

            await conn.run_sync(migrate, "0003_identity")
            await conn.execute(
                text(
                    "INSERT INTO specialties(name_en,name_ar) "
                    "VALUES ('Synthetic','تجريبي')"
                )
            )
            await conn.run_sync(migrate, "head")
            assert await conn.scalar(text("SELECT count(*) FROM specialties")) == 1
            await conn.execute(text("GRANT USAGE ON SCHEMA clinic TO clinic_runtime"))
            await conn.execute(text("SET LOCAL ROLE clinic_runtime"))
            await conn.execute(
                text(
                    "INSERT INTO "
                    "clinic_closures(closure_date,reason_en,reason_ar)"
                    " VALUES "
                    "('2026-10-20','Synthetic','تجريبي')"
                )
            )
            assert await conn.scalar(text("SELECT count(*) FROM clinic_closures")) == 1
            assert (
                await conn.scalar(text("SELECT nextval('doctor_time_off_id_seq')")) == 1
            )
            assert await conn.scalar(text("SELECT count(*) FROM appointments")) == 0
            assert (
                await conn.scalar(text("SELECT count(*) FROM appointment_history")) == 0
            )
        finally:
            await transaction.rollback()
