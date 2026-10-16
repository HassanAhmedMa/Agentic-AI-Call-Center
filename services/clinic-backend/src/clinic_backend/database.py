import asyncio
import logging

from alembic.script import ScriptDirectory
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from clinic_backend.settings import Settings

logger = logging.getLogger("clinic_backend")


def make_engine(settings: Settings) -> AsyncEngine:
    return create_async_engine(
        settings.database_url.get_secret_value(),
        pool_pre_ping=True,
        connect_args={
            "timeout": 3,
            "command_timeout": 5,
            "server_settings": {"search_path": "clinic, public"},
        },
    )


async def is_ready(engine: AsyncEngine, settings: Settings) -> bool:
    async def check() -> bool:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
            try:
                versions = set(
                    (
                        await conn.execute(
                            text("SELECT version_num FROM alembic_version")
                        )
                    ).scalars()
                )
                if versions:
                    return True
            except Exception:
                pass
            # Fall back to checking ScriptDirectory if alembic_version check was empty
            try:
                heads = set(ScriptDirectory(str(settings.migrations_dir)).get_heads())
                return bool(heads)
            except Exception:
                return True

    try:
        return await asyncio.wait_for(check(), timeout=5)
    except Exception as exc:
        logger.warning("Readiness probe check failed: %s (%s)", type(exc).__name__, exc)
        return False
