import httpx
from clinic_backend.app import create_app
from clinic_backend.settings import Settings

TOKEN = "synthetic-admin-token-12345678901234567890"


async def test_admin_disabled_and_unauthenticated_requests_fail_closed():
    for token, expected in [(None, 403), (TOKEN, 401)]:
        values = {"database_url": "postgresql+asyncpg://unused@localhost/unused"}
        if token:
            values["admin_api_token"] = token
        app = create_app(Settings(**values))
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            for path in ["/api/v1/admin/patients", "/api/v1/appointments"]:
                response = await client.get(path)
                assert response.status_code == expected
            response = await client.post("/api/v1/ws/broadcast", json={})
            assert response.status_code == expected


async def test_admin_token_authorizes_broadcast_only_when_correct():
    app = create_app(
        Settings(
            database_url="postgresql+asyncpg://unused@localhost/unused",
            admin_api_token=TOKEN,
        )
    )
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        denied = await client.post(
            "/api/v1/ws/broadcast", json={}, headers={"X-Admin-Token": "invalid"}
        )
        assert denied.status_code == 401
        accepted = await client.post(
            "/api/v1/ws/broadcast", json={}, headers={"X-Admin-Token": TOKEN}
        )
        assert accepted.status_code == 200
