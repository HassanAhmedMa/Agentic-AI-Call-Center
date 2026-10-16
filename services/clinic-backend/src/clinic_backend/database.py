import asyncio
import logging
from typing import Any

from alembic.script import ScriptDirectory
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from clinic_backend.settings import Settings

logger = logging.getLogger("clinic_backend")


def connection_args(settings: Settings) -> dict[str, Any]:
    return {
        "timeout": 3,
        "command_timeout": 5,
        "server_settings": {"search_path": f'"{settings.database_schema}", pg_catalog'},
    }


def make_engine(settings: Settings) -> AsyncEngine:
    return create_async_engine(
        settings.database_url.get_secret_value(),
        pool_pre_ping=True,
        connect_args=connection_args(settings),
    )


async def is_ready(engine: AsyncEngine, settings: Settings) -> bool:
    async def check() -> bool:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
            try:
                heads = set(ScriptDirectory(str(settings.migrations_dir)).get_heads())
            except Exception:
                heads = set()
            try:
                versions = set(
                    (
                        await conn.execute(text("SELECT version_num FROM alembic_version"))
                    ).scalars()
                )
            except Exception:
                versions = set()

            if settings.identity_enabled and settings.identity_provider == "supabase":
                try:
                    if not await conn.scalar(
                        text(
                            "SELECT to_regprocedure(current_schema() || "
                            "'.auth_session_active(uuid,uuid)') IS NOT NULL"
                        )
                    ):
                        return False
                except Exception:
                    pass

            if heads and versions:
                return heads == versions
            return bool(versions) or bool(heads)

    try:
        return await asyncio.wait_for(check(), timeout=5)
    except Exception as exc:
        logger.warning("Readiness probe check failed: %s (%s)", type(exc).__name__, exc)
        return False
