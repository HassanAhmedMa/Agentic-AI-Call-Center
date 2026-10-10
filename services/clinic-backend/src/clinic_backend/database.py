import asyncio

from alembic.script import ScriptDirectory
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from clinic_backend.settings import Settings


def make_engine(settings: Settings) -> AsyncEngine:
    return create_async_engine(
        settings.database_url.get_secret_value(),
        pool_pre_ping=True,
        connect_args={"timeout": 3, "command_timeout": 5},
    )


async def is_ready(engine: AsyncEngine, settings: Settings) -> bool:
    async def check() -> bool:
        heads = set(ScriptDirectory(str(settings.migrations_dir)).get_heads())
        async with engine.connect() as conn:
            versions = set(
                (
                    await conn.execute(text("SELECT version_num FROM alembic_version"))
                ).scalars()
            )
        return bool(heads) and heads == versions

    try:
        return await asyncio.wait_for(check(), timeout=5)
    except Exception:
        # Readiness must not leak connection strings, SQL or schema state.
        return False
