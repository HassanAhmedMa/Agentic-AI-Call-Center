from unittest.mock import AsyncMock

import pytest
from clinic_backend.ai_agent.patient_tools import execute, schemas
from pydantic import ValidationError


@pytest.mark.asyncio
async def test_patient_context_tool_uses_verified_adapter():
    api = AsyncMock()
    api.patient_context.return_value = {"first_name": "Synthetic"}
    assert await execute(api, "get_patient_context", {}) == {"first_name": "Synthetic"}
    api.patient_context.assert_awaited_once()


@pytest.mark.asyncio
async def test_best_slot_tool_filters_patient_overlap():
    api = AsyncMock()
    api.appointments.return_value = {
        "total": 1,
        "appointments": [
            {
                "id": 3,
                "date": "2026-12-01",
                "start_time": "14:00",
                "end_time": "14:30",
                "status": "scheduled",
                "doctor": {"id": 1},
            }
        ],
    }
    api.availability.return_value = {
        "days": [{"date": "2026-12-01", "slots": ["10:00", "14:00", "14:30"]}]
    }
    result = await execute(
        api, "recommend_best_slot", {"doctor_id": 2, "from_date": "2026-12-01"}
    )
    assert result["slots"][0]["start_time"] == "14:30"
    assert result["reserved"] is False


def test_context_schema_rejects_supplied_patient_id():
    from clinic_backend.ai_agent.patient_tools import Empty

    with pytest.raises(ValidationError):
        Empty.model_validate({"patient_id": 7})
    assert len(schemas()) == 5


@pytest.mark.asyncio
async def test_adjacent_suggestions_only_include_live_free_slots():
    api = AsyncMock()
    api.appointments.return_value = {
        "total": 1,
        "appointments": [
            {
                "id": 3,
                "date": "2026-12-01",
                "start_time": "10:00",
                "end_time": "10:30",
                "status": "scheduled",
                "doctor": {"id": 1},
            }
        ],
    }
    api.availability.return_value = {
        "days": [{"date": "2026-12-01", "slots": ["09:30", "10:30", "11:30"]}]
    }
    result = await execute(
        api, "recommend_best_slot", {"doctor_id": 2, "from_date": "2026-12-01"}
    )
    assert [(x["position"], x["start_time"]) for x in result["adjacent_slots"]] == [
        ("before", "09:30"),
        ("after", "10:30"),
    ]
    api.availability.return_value = {
        "days": [{"date": "2026-12-01", "slots": ["11:30"]}]
    }
    result = await execute(
        api, "recommend_best_slot", {"doctor_id": 2, "from_date": "2026-12-01"}
    )
    assert result["adjacent_slots"] == []
