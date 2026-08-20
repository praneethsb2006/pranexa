from fastapi import APIRouter
from pydantic import BaseModel


router = APIRouter(
    prefix="/api/v1/chat",
    tags=["Chat"],
)


class ChatRequest(BaseModel):
    message: str
    mode: str = "explain"


class ChatResponse(BaseModel):
    response: str
    mode: str


@router.post("")
async def chat(request: ChatRequest) -> ChatResponse:
    return ChatResponse(
        response=f"Pranexa received your message: {request.message}",
        mode=request.mode,
    )
