import os
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from tests.integration.conftest import ROOT


async def test_private_auth_projection_checks_sessions_without_exposing_auth():
    url = os.getenv("TEST_DATABASE_URL")
    if not url:
        pytest.skip("Real PostgreSQL required")
    name = "test_auth_priv_" + uuid4().hex
    admin = create_async_engine(url, poolclass=NullPool, isolation_level="AUTOCOMMIT")
    engine = create_async_engine(make_url(url).set(database=name), poolclass=NullPool)
    created = False
    try:
        async with admin.connect() as c:
            await c.execute(text(f'CREATE DATABASE "{name}"'))
            created = True
        async with engine.begin() as c:
            for role in ("clinic_runtime", "anon", "authenticated"):
                exists = await c.scalar(
                    text("SELECT 1 FROM pg_roles WHERE rolname=:r"), {"r": role}
                )
                if not exists:
                    pytest.skip("Provision restricted test roles in isolated cluster")
            await c.execute(text("CREATE SCHEMA auth"))
            await c.execute(text("CREATE SCHEMA clinic"))
            await c.execute(text("GRANT USAGE ON SCHEMA clinic TO clinic_runtime"))
            await c.execute(
                text(
                    "CREATE TABLE auth.sessions("
                    "id uuid,user_id uuid,not_after timestamptz)"
                )
            )
            user, session = uuid4(), uuid4()
            await c.execute(
                text("INSERT INTO auth.sessions VALUES (:s,:u,NULL)"),
                {"s": session, "u": user},
            )
            await c.execute(text("ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY"))
        async with engine.connect() as c:
            raw = await c.get_raw_connection()
            await raw.driver_connection.execute(
                (
                    ROOT / "database/manual/04-supabase-auth-session-access.sql"
                ).read_text()
            )
        async with engine.begin() as c:
            assert (
                await c.scalar(
                    text(
                        "SELECT has_function_privilege('anon',"
                        "'clinic.auth_session_active(uuid,uuid)','EXECUTE')"
                    )
                )
                is False
            )
            assert (
                await c.scalar(
                    text(
                        "SELECT has_table_privilege('clinic_runtime',"
                        "'clinic.auth_session_projection','SELECT')"
                    )
                )
                is False
            )
            await c.execute(text("SET LOCAL ROLE clinic_runtime"))
            assert (
                await c.scalar(
                    text("SELECT clinic.auth_session_active(:u,:s)"),
                    {"u": user, "s": session},
                )
                is True
            )
            assert (
                await c.scalar(
                    text("SELECT clinic.auth_session_active(:u,:s)"),
                    {"u": uuid4(), "s": session},
                )
                is False
            )
            with pytest.raises(DBAPIError):
                async with c.begin_nested():
                    await c.execute(text("SELECT id FROM auth.sessions"))
        async with engine.begin() as c:
            await c.execute(
                text("UPDATE auth.sessions SET not_after=now()-interval '1 second'")
            )
            await c.execute(text("SET LOCAL ROLE clinic_runtime"))
            assert (
                await c.scalar(
                    text("SELECT clinic.auth_session_active(:u,:s)"),
                    {"u": user, "s": session},
                )
                is False
            )
    finally:
        await engine.dispose()
        if created:
            async with admin.connect() as c:
                assert name.startswith("test_auth_priv_")
                await c.execute(text(f'DROP DATABASE "{name}"'))
        await admin.dispose()
