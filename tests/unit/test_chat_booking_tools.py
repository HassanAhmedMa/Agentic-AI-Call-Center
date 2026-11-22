from unittest.mock import AsyncMock, patch

import httpx
import pytest
from clinic_backend.ai_agent.booking_tools import BookingTools, interpret_consent


@pytest.mark.asyncio
async def test_confirmation_requires_new_affirmative_turn():
    api = AsyncMock()
    api.client.post.side_effect = [
        httpx.Response(200, json={"proposal": "signed", "selection": {"doctor_id": 7}}),
        httpx.Response(200, json={"saved": True, "appointment": {"id": 42}}),
    ]
    state = {}
    first = BookingTools(api, state, "turn-1", "book tomorrow")
    result = await first.execute(
        "propose_booking", {"doctor_id": 7, "date": "2026-11-24", "start_time": "09:30"}
    )
    assert result["reserved"] is False
    assert (await first.execute("confirm_pending_action", {}))["success"] is False
    assert (
        await BookingTools(api, state, "turn-2", "no").execute(
            "confirm_pending_action", {}
        )
    )["success"] is False
    result = await BookingTools(
        api,
        state,
        "turn-2",
        "That works for me, go ahead",
        AsyncMock(return_value=True),
    ).execute("confirm_pending_action", {})
    assert result["saved"] is True
    assert api.client.post.await_count == 2


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "tool,arguments",
    [
        (
            "propose_reschedule",
            {"appointment_id": 42, "date": "2026-11-25", "start_time": "11:00"},
        ),
        ("propose_cancellation", {"appointment_id": 42, "reason": "Synthetic test"}),
    ],
)
async def test_change_tools_prepare_then_confirm(tool, arguments):
    api = AsyncMock()
    api.client.post.side_effect = [
        httpx.Response(200, json={"proposal": "signed", "selection": arguments}),
        httpx.Response(200, json={"saved": True, "appointment": {"id": 42}}),
    ]
    state = {}
    proposal = await BookingTools(api, state, "first", "change").execute(
        tool, arguments
    )
    assert proposal["requires_confirmation"]
    assert api.client.post.call_args.args[0].endswith("propose-change")
    result = await BookingTools(
        api, state, "second", "go ahead", AsyncMock(return_value=True)
    ).execute("confirm_pending_action", {})
    assert result["saved"]


@pytest.mark.parametrize(
    "content,expected",
    [
        ('{"decision":"confirm"}', True),
        ('```json\n{"decision":"confirm"}\n```', True),
        ('{"decision":"decline"}', False),
        ('{"decision":"change"}', False),
        ('{"decision":"confirm","extra":true}', False),
        ("Not JSON", False),
    ],
)
async def test_consent_receives_pending_operation_and_fails_closed(content, expected):
    def respond(request):
        import json

        payload = json.loads(request.content)
        assert '"operation": "cancel"' in payload["messages"][0]["content"]
        return httpx.Response(
            200, json={"choices": [{"message": {"content": content}}]}
        )

    client = httpx.AsyncClient(transport=httpx.MockTransport(respond))
    with patch(
        "clinic_backend.ai_agent.booking_tools.httpx.AsyncClient", return_value=client
    ):
        result = await interpret_consent(
            "Yes, cancel it please.",
            url="https://synthetic.example.test",
            key="synthetic-key",
            model="synthetic-model",
            proposal={"operation": "cancel", "appointment_id": 42},
        )
    assert result is expected
