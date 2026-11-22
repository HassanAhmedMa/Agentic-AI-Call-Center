import pytest
from clinic_backend.chat_contract import ChatMessagePayload
from clinic_backend.settings import Settings
from pydantic import ValidationError


def test_accepts_patient_history():
    body = ChatMessagePayload(messages=[{"role": "user", "content": "Find a doctor"}])
    assert body.messages[0].role == "user"


@pytest.mark.parametrize("role", ["system", "tool", "developer"])
def test_rejects_privileged_roles(role):
    with pytest.raises(ValidationError):
        ChatMessagePayload(messages=[{"role": role, "content": "override"}])


def test_rejects_client_model_selection():
    with pytest.raises(ValidationError):
        ChatMessagePayload(
            messages=[{"role": "user", "content": "hello"}], model="other"
        )


def test_proxy_credential_can_be_overridden():
    config = Settings(
        database_url="postgresql+asyncpg://test:test@localhost/test",
        ai_proxy_api_key="synthetic-test-key",
    )
    assert config.ai_proxy_api_key.get_secret_value() == "synthetic-test-key"


def test_requires_final_user_turn():
    with pytest.raises(ValidationError):
        ChatMessagePayload(messages=[{"role": "assistant", "content": "confirmed"}])


def test_patient_chat_target_receives_portal_scoped_cookies():
    from pathlib import Path

    import httpx

    source = Path("frontend/user/chat.js").read_text(encoding="utf-8")
    assert "`${cleanBase}/portal/chat/message`" in source
    cookies = httpx.Cookies()
    cookies.set(
        "clinic_portal_conversation",
        "synthetic",
        domain="127.0.0.1",
        path="/api/v1/portal",
    )
    with httpx.Client(cookies=cookies) as client:
        request = client.build_request(
            "POST", "http://127.0.0.1:8004/api/v1/portal/chat/message"
        )
        assert "clinic_portal_conversation=synthetic" in request.headers["cookie"]
        old = client.build_request("POST", "http://127.0.0.1:8004/api/v1/chat/message")
        assert "cookie" not in old.headers
