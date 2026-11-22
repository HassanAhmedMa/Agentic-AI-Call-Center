import httpx
import pytest
from clinic_backend.ai_agent.appointments import AppointmentAPI


@pytest.mark.asyncio
async def test_patient_mutations_use_controlled_endpoints_and_credentials():
    requests = []

    async def respond(request):
        requests.append(request)
        return httpx.Response(200, json={"id": 7, "status": "scheduled"})

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(respond), base_url="http://test"
    ) as client:
        api = AppointmentAPI(client, "conversation-secret", "service-secret")
        await api.book(
            {"doctor_id": 2, "date": "2026-12-01", "start_time": "14:00"},
            "proposal_1234",
        )
        await api.reschedule(
            7, {"date": "2026-12-02", "start_time": "15:00"}, "proposal_5678"
        )
        await api.cancel(7, {}, "proposal_9012")
    assert [r.url.path for r in requests] == [
        "/api/v1/patients/me/appointments",
        "/api/v1/patients/me/appointments/7/reschedule",
        "/api/v1/patients/me/appointments/7/cancel",
    ]
    assert all(
        r.headers["X-Conversation-Token"] == "conversation-secret" for r in requests
    )
    assert all(r.headers["X-Service-Token"] == "service-secret" for r in requests)
    assert requests[0].headers["Idempotency-Key"] == "proposal_1234"


@pytest.mark.asyncio
async def test_rejects_patient_id_before_network_call():
    async with httpx.AsyncClient(base_url="http://test") as client:
        api = AppointmentAPI(client, "conversation", None)
        with pytest.raises(ValueError):
            await api.book(
                {
                    "patient_id": 9,
                    "doctor_id": 2,
                    "date": "2026-12-01",
                    "start_time": "14:00",
                },
                "proposal_1234",
            )


@pytest.mark.asyncio
async def test_availability_uses_bounded_calendar_query():
    async def respond(request):
        assert request.url.params["from_date"] == "2026-12-01"
        assert request.url.path == "/api/v1/doctors/2/availability"
        return httpx.Response(200, json={"days": []})

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(respond), base_url="http://test"
    ) as client:
        result = await AppointmentAPI(client, "conversation", None).availability(
            2, {"from_date": "2026-12-01"}
        )
        assert result == {"days": []}


@pytest.mark.asyncio
async def test_patient_context_exposes_only_minimal_profile():
    async def respond(request):
        assert request.url.path == "/api/v1/portal/session"
        assert "X-Service-Token" not in request.headers
        return httpx.Response(
            200,
            json={
                "first_name": "Synthetic",
                "preferred_language": "ar",
                "email": "private@example.invalid",
                "phone": "+201000000000",
                "customer_number": "123456",
            },
        )

    async with httpx.AsyncClient(
        transport=httpx.MockTransport(respond), base_url="http://test"
    ) as client:
        result = await AppointmentAPI(
            client, "conversation", "synthetic-service"
        ).patient_context()
    assert result == {
        "first_name": "Synthetic",
        "preferred_language": "ar",
        "profile_complete": True,
    }
