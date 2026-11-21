import pytest
from unittest.mock import AsyncMock, MagicMock
from decimal import Decimal
import json

from clinic_schemas import catalog as dto
from clinic_backend.ai_agent.tools import (
    get_available_tools_schema,
    execute_fetch_doctors,
    FETCH_DOCTORS_TOOL,
)
from clinic_backend.ai_agent.orchestrator import assemble_tool_call, format_sse


def test_tool_schema_structure():
    schemas = get_available_tools_schema()
    assert len(schemas) >= 1
    tool = schemas[0]
    assert tool["type"] == "function"
    assert tool["function"]["name"] == "fetch_doctors"
    assert "specialty_name" in tool["function"]["parameters"]["properties"]


@pytest.mark.asyncio
async def test_execute_fetch_doctors_arabic():
    mock_catalog = MagicMock()
    mock_doctor = dto.Doctor(
        id=10,
        name_en="Dr. Hany Mostafa",
        name_ar="د. هاني مصطفى",
        title_en="Consultant Cardiologist",
        title_ar="استشاري القلب والقسطرة",
        specialty=dto.Specialty(id=1, name_en="Cardiology", name_ar="أمراض القلب"),
        languages=["ar", "en"],
        consultation_fee=dto.Money(amount=Decimal("400.00"), currency="EGP"),
        working_days=["monday", "thursday"],
        shift_start="10:00",
        shift_end="16:00",
    )
    mock_catalog.doctors = AsyncMock(
        return_value=dto.DoctorList(doctors=[mock_doctor], total=1)
    )

    result = await execute_fetch_doctors(mock_catalog, "قلب", "ar")
    assert result["success"] is True
    assert result["count"] == 1
    assert result["ui_widget"] is not None
    assert result["ui_widget"]["type"] == "doctor_cards"
    assert len(result["ui_widget"]["doctors"]) == 1
    assert result["ui_widget"]["doctors"][0]["name"] == "د. هاني مصطفى"
    assert "400 جنيه" in result["ui_widget"]["doctors"][0]["fee"]


def test_assemble_tool_call():
    chunks = [
        [
            {
                "id": "call_abc123",
                "function": {"name": "fetch_doctors", "arguments": '{"specialty_'},
            }
        ],
        [{"function": {"arguments": 'name": "القلب"}'}}],
    ]
    fn_name, args_str, call_id = assemble_tool_call(chunks)
    assert fn_name == "fetch_doctors"
    assert call_id == "call_abc123"
    parsed_args = json.loads(args_str)
    assert parsed_args["specialty_name"] == "القلب"


def test_format_sse():
    res = format_sse("token", {"text": "مرحباً"})
    assert res == 'event: token\ndata: {"text": "مرحباً"}\n\n'
