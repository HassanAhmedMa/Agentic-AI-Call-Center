import asyncio

from alembic import context
from clinic_backend.models import Base
from clinic_backend.settings import Settings
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool


def run_migrations(connection):
    context.configure(connection=connection, target_metadata=Base.metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_online():
    settings = Settings()
    engine = create_async_engine(
        settings.database_url.get_secret_value(), poolclass=NullPool
    )
    async with engine.connect() as connection:
        await connection.run_sync(run_migrations)
    await engine.dispose()


if context.is_offline_mode():
    context.configure(
        url="postgresql+asyncpg://localhost/clinic",
        target_metadata=Base.metadata,
        literal_binds=True,
    )
    with context.begin_transaction():
        context.run_migrations()
elif context.config.attributes.get("connection") is not None:
    run_migrations(context.config.attributes["connection"])
else:
    asyncio.run(run_online())
