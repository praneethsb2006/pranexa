from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=10000)
    mode: str = Field(default="explain", min_length=1, max_length=50)


class ChatResponse(BaseModel):
    response: str
    mode: str