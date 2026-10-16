import pytest
from clinic_backend.app import create_app
from clinic_backend.settings import Settings
from clinic_backend.websocket_manager import ConnectionManager
from fastapi.testclient import TestClient


@pytest.mark.asyncio
async def test_websocket_manager_lifecycle():
    manager = ConnectionManager()
    assert len(manager.active_connections) == 0


def test_websocket_endpoint_connection_and_heartbeat():
    app = create_app(
        Settings(
            database_url="postgresql+asyncpg://postgres@127.0.0.1:1/missing",
            admin_api_token="synthetic-admin-token-12345678901234567890",
        )
    )
    client = TestClient(app)

    with client.websocket_connect("/api/v1/ws") as ws:
        ws.send_json({"token": "synthetic-admin-token-12345678901234567890"})
        init_msg = ws.receive_json()
        assert init_msg["event"] == "CONNECTED"
        assert init_msg["data"]["status"] == "ready"

        ws.send_text("ping")
        resp = ws.receive_text()
        assert resp == "pong"

        ws.send_text("heartbeat")
        resp_json = ws.receive_json()
        assert resp_json["event"] == "PONG"


def test_websocket_broadcast_api():
    app = create_app(
        Settings(
            database_url="postgresql+asyncpg://postgres@127.0.0.1:1/missing",
            admin_api_token="synthetic-admin-token-12345678901234567890",
        )
    )
    client = TestClient(app)

    with client.websocket_connect("/api/v1/ws") as ws:
        ws.send_json({"token": "synthetic-admin-token-12345678901234567890"})
        # Drain initial CONNECTED message
        init_msg = ws.receive_json()
        assert init_msg["event"] == "CONNECTED"

        # Trigger HTTP broadcast endpoint
        resp = client.post(
            "/api/v1/ws/broadcast",
            headers={"X-Admin-Token": "synthetic-admin-token-12345678901234567890"},
            json={
                "event": "PATIENT_UPDATED",
                "data": {"customer_number": "166967", "full_name": "Test Patient"},
            },
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "broadcasted"
        assert resp.json()["active_clients"] >= 1

        # Client receives broadcasted event
        received = ws.receive_json()
        assert received["event"] == "PATIENT_UPDATED"
        assert received["data"]["customer_number"] == "166967"
        assert "timestamp" in received


def test_websocket_rejects_invalid_admin_token():
    from starlette.websockets import WebSocketDisconnect

    app = create_app(
        Settings(
            database_url="postgresql+asyncpg://unused@localhost/unused",
            admin_api_token="synthetic-admin-token-12345678901234567890",
        )
    )
    with TestClient(app) as client:
        with client.websocket_connect("/api/v1/ws") as ws:
            ws.send_json({"token": "invalid"})
            with pytest.raises(WebSocketDisconnect) as denied:
                ws.receive_json()
            assert denied.value.code == 4401
