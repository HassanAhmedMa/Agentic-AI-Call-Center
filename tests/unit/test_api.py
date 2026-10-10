from clinic_backend.app import create_app
from clinic_backend.settings import Settings
from fastapi.testclient import TestClient


def client() -> TestClient:
    return TestClient(
        create_app(
            Settings(database_url="postgresql+asyncpg://postgres@127.0.0.1:1/missing")
        )
    )


def test_liveness_is_independent_of_database() -> None:
    with client() as http:
        response = http.get("/api/v1/health", headers={"X-Request-Id": "review-123"})
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}
        assert response.headers["X-Request-Id"] == "review-123"


def test_database_down_returns_sanitized_errors() -> None:
    with client() as http:
        for path in ["/api/v1/health/ready", "/api/v1/doctors"]:
            response = http.get(path)
            assert response.status_code == 503
            error = response.json()["error"]
            assert error["request_id"] == response.headers["X-Request-Id"]
            assert "postgres" not in response.text
            assert "127.0.0.1" not in response.text
            assert error["timestamp"].endswith("Z")


def test_query_validation_uses_400_and_never_echoes_input() -> None:
    with client() as http:
        for path in [
            "/api/v1/doctors?limit=101",
            "/api/v1/doctors?limit=0",
            "/api/v1/doctors?offset=-1",
            "/api/v1/doctors?specialty_id=0",
            "/api/v1/doctors?unknown=private-value",
            "/api/v1/doctors?limit=bad",
            "/api/v1/doctors?q=" + "a" * 101,
            "/api/v1/services?category=",
            "/api/v1/services?unknown=private-value",
            "/api/v1/doctors/0",
            "/api/v1/services/nope",
            "/api/v1/specialties?unknown=private-value",
            "/api/v1/doctors/1?unknown=private-value",
        ]:
            response = http.get(path)
            assert response.status_code == 400, (path, response.text)
            assert response.json()["error"]["code"] == "VALIDATION_FAILED"
            assert "private-value" not in response.text


def test_catalog_rate_limit_and_health_exemption() -> None:
    app = create_app(
        Settings(
            database_url="postgresql+asyncpg://postgres@127.0.0.1:1/missing",
            public_rate_limit=2,
        )
    )
    with TestClient(app) as http:
        http.get("/api/v1/doctors?limit=0")
        http.get("/api/v1/services?limit=0")
        response = http.get("/api/v1/specialties")
        assert response.status_code == 429
        assert response.json()["error"]["code"] == "RATE_LIMITED"
        assert int(response.headers["Retry-After"]) >= 1
        assert http.get("/api/v1/health").status_code == 200


def test_validation_reports_safe_field_metadata() -> None:
    with client() as http:
        response = http.get("/api/v1/doctors?limit=bad")
        assert response.json()["error"]["details"]["fields"] == [
            {"field": "query.limit", "reason": "int_parsing"},
        ]
        for path in [
            "/api/v1/doctors?private-value=secret",
            "/api/v1/specialties?private-value=secret",
        ]:
            response = http.get(path)
            assert response.status_code == 400
            assert response.json()["error"]["details"]["fields"]
            assert "private-value" not in response.text
            assert "secret" not in response.text


def test_openapi_documents_actual_validation_status() -> None:
    with client() as http:
        responses = http.get("/openapi.json").json()["paths"]["/api/v1/doctors"]["get"][
            "responses"
        ]
        assert "400" in responses
        assert "422" not in responses
