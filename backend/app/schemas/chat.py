from typing import Literal
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=10000)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=10000)
    mode: str = Field(default="explain", min_length=1, max_length=50)
    history: list[ChatMessage] = Field(default_factory=list, max_length=50)
    conversation_id: str | None = None


class ChatResponse(BaseModel):
    response: str
    mode: str
    conversation_id: str