"""Explicit, atomic synthetic seed command; never runs on API startup."""

import argparse
import asyncio
import json
from datetime import date, datetime, time, timedelta
from pathlib import Path

from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncEngine

from clinic_backend.database import make_engine
from clinic_backend.models import Doctor, Service, Specialty
from clinic_backend.scheduling_models import ClinicClosure, DoctorTimeOff
from clinic_backend.search import normalize_search
from clinic_backend.settings import Settings
from clinic_backend.slot_rules import CAIRO


async def seed_catalog(engine: AsyncEngine, path: Path) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    async with engine.begin() as conn:
        # Serialize concurrent demo seed runs. Existing rows are never overwritten.
        await conn.execute(text("SELECT pg_advisory_xact_lock(41001001)"))
        for row in data["specialties"]:
            row["search_terms"] = sorted(
                {
                    normalize_search(t)
                    for t in [row["name_en"], row["name_ar"], *row["synonyms"]]
                }
            )
            await conn.execute(
                insert(Specialty)
                .values(**row)
                .on_conflict_do_nothing(index_elements=["id"])
            )
        for row in data["doctors"]:
            row["shift_start"] = time.fromisoformat(row["shift_start"])
            row["shift_end"] = time.fromisoformat(row["shift_end"])
            await conn.execute(
                insert(Doctor)
                .values(**row)
                .on_conflict_do_nothing(index_elements=["id"])
            )
        for row in data["services"]:
            await conn.execute(
                insert(Service)
                .values(**row)
                .on_conflict_do_nothing(index_elements=["id"])
            )
        for table in ("specialties", "doctors", "services"):
            # Names come only from the fixed allowlist, never user input.
            await conn.execute(
                text(
                    f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), "
                    f"GREATEST((SELECT max(id) FROM {table}), "
                    f"nextval(pg_get_serial_sequence('{table}', 'id'))), true)"
                )
            )


async def seed_scheduling(engine: AsyncEngine, path: Path, base_date: date) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    async with engine.begin() as conn:
        await conn.execute(text("SELECT pg_advisory_xact_lock(41001001)"))
        for row in data["closures"]:
            await conn.execute(
                insert(ClinicClosure)
                .values(
                    closure_date=base_date + timedelta(days=row["day_offset"]),
                    reason_en=row["reason_en"],
                    reason_ar=row["reason_ar"],
                )
                .on_conflict_do_nothing(index_elements=["closure_date"])
            )
        for row in data["time_off"]:
            off_date = base_date + timedelta(days=row["day_offset"])
            start = time.fromisoformat(row["start_time"]) if row["start_time"] else None
            end = time.fromisoformat(row["end_time"]) if row["end_time"] else None
            existing = await conn.scalar(
                select(DoctorTimeOff.id).where(
                    DoctorTimeOff.doctor_id == row["doctor_id"],
                    DoctorTimeOff.off_date == off_date,
                    DoctorTimeOff.start_time.is_not_distinct_from(start),
                    DoctorTimeOff.end_time.is_not_distinct_from(end),
                )
            )
            if existing is None:
                await conn.execute(
                    insert(DoctorTimeOff).values(
                        doctor_id=row["doctor_id"],
                        off_date=off_date,
                        start_time=start,
                        end_time=end,
                        reason=row["reason"],
                    )
                )


async def run(
    path: Path, scheduling_file: Path | None = None, base_date: date | None = None
) -> None:
    engine = make_engine(Settings())
    try:
        await seed_catalog(engine, path)
        if scheduling_file is not None:
            await seed_scheduling(
                engine, scheduling_file, base_date or datetime.now(CAIRO).date()
            )
    finally:
        await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description="Load synthetic public clinic catalog")
    parser.add_argument("--file", type=Path, default=Path("database/seed/catalog.json"))
    parser.add_argument("--scheduling-file", type=Path)
    parser.add_argument("--scheduling-base-date", type=date.fromisoformat)
    args = parser.parse_args()
    asyncio.run(run(args.file, args.scheduling_file, args.scheduling_base_date))
    print("Synthetic catalog seeded; existing rows preserved.")


if __name__ == "__main__":
    main()
