"""Explicit, atomic synthetic seed command; never runs on API startup."""

import argparse
import asyncio
import json
from datetime import time
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncEngine

from clinic_backend.database import make_engine
from clinic_backend.models import Doctor, Service, Specialty
from clinic_backend.search import normalize_search
from clinic_backend.settings import Settings


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


async def run(path: Path) -> None:
    engine = make_engine(Settings())
    try:
        await seed_catalog(engine, path)
    finally:
        await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description="Load synthetic public clinic catalog")
    parser.add_argument("--file", type=Path, default=Path("database/seed/catalog.json"))
    args = parser.parse_args()
    asyncio.run(run(args.file))
    print("Synthetic catalog seeded; existing rows preserved.")


if __name__ == "__main__":
    main()
