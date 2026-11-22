from pathlib import Path

import pytest
from clinic_backend.seed import seed_catalog
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

ROOT = Path(__file__).resolve().parents[2]


async def test_scheduling_schema_and_structural_constraints(engine):
    await seed_catalog(engine, ROOT / "database/seed/catalog.json")
    async with engine.begin() as c:
        tables = set(
            (
                await c.execute(
                    text(
                        (
                            "SELECT tablename FROM pg_tables WHERE "
                            "schemaname=current_schema()"
                        )
                    )
                )
            ).scalars()
        )
        assert {
            "clinic_closures",
            "doctor_time_off",
            "appointments",
            "appointment_history",
        } <= tables
        await c.execute(
            text(
                "INSERT INTO patients(customer_number,full_name,email,"
                "\n            email_verified_at,phone,date_of_birth) VALUES"
                "\n            ('000000','Synthetic Patient',"
                "'synthetic@example.test',now(),'+201000000001','1988-01-01')"
            )
        )
        await c.execute(
            text(
                "INSERT INTO "
                "appointments(patient_id,doctor_id,appointment_date,start_time,end_time)"
                "\n            SELECT "
                "id,1,'2026-10-15','10:00','10:30' FROM "
                "patients"
            )
        )
        for assignment in [
            "appointment_date='2026-10-16'",
            "start_time='10:15'",
            "end_time='11:00'",
            "status='cancelled'",
            "start_time='23:30',end_time='00:00'",
        ]:
            with pytest.raises(IntegrityError):
                async with c.begin_nested():
                    await c.execute(text("UPDATE appointments SET " + assignment))
        with pytest.raises(IntegrityError):
            async with c.begin_nested():
                await c.execute(
                    text(
                        "INSERT INTO "
                        "appointments(patient_id,doctor_id,appointment_date,start_time,end_time)"
                        "\n                    SELECT "
                        "id,1,'2026-10-15','10:00','10:30' FROM "
                        "patients"
                    )
                )
        with pytest.raises(IntegrityError):
            async with c.begin_nested():
                await c.execute(
                    text(
                        "INSERT INTO "
                        "appointments(patient_id,doctor_id,appointment_date,start_time,end_time)"
                        "\n                    SELECT "
                        "id,2,'2026-10-15','10:00','10:30' FROM "
                        "patients"
                    )
                )
        await c.execute(
            text(
                "UPDATE appointments SET "
                "status='cancelled',cancelled_at=now(),cancelled_by='patient'"
            )
        )
        await c.execute(
            text(
                "INSERT INTO "
                "appointments(patient_id,doctor_id,appointment_date,start_time,end_time)"
                "\n            SELECT "
                "id,1,'2026-10-15','10:00','10:30' FROM "
                "patients"
            )
        )
        for values in [
            "1,'2026-10-15','12:00',NULL",
            "1,'2026-10-15','12:15','13:00'",
            "1,'2026-10-15','13:00','12:00'",
        ]:
            with pytest.raises(IntegrityError):
                async with c.begin_nested():
                    await c.execute(
                        text(
                            (
                                "INSERT INTO "
                                "doctor_time_off(doctor_id,off_date,start_time,end_time)"
                                " VALUES ("
                            )
                            + values
                            + ")"
                        )
                    )
        protected = await c.scalar(
            text(
                "SELECT bool_and(rowsecurity) FROM pg_tables WHERE "
                "schemaname=current_schema() AND tablename IN "
                "('clinic_closures','doctor_time_off',"
                "'appointments','appointment_history')"
            )
        )
        assert protected
