from typing import Literal

from pydantic import BaseModel, ConfigDict


class ConversationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    channel: Literal["voice", "text"]


class ConversationCreated(BaseModel):
    conversation_token: str
    channel: Literal["voice", "text"]
    resume_window_seconds: int = 300


class ConversationEvent(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    event: Literal["disconnected", "reconnected", "ended"]
