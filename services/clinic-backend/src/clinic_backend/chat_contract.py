("Untrusted browser chat input. Credentials and model cho" "ice stay server-side.")

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)


class ChatMessagePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    messages: list[ChatMessage] = Field(min_length=1, max_length=60)
    language: Literal["ar", "en"] = "ar"
    confirmation_id: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")
    thread_id: str = Field(
        default="default", min_length=1, max_length=128, pattern=r"^[A-Za-z0-9_-]+$"
    )

    @model_validator(mode="after")
    def final_user_turn(self) -> "ChatMessagePayload":
        if self.messages[-1].role != "user":
            raise ValueError("A chat request must end with a user message")
        return self
