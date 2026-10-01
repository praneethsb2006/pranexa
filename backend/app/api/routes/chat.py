from fastapi import APIRouter, Depends

from app.api.dependencies.auth import AuthenticatedUser, get_authenticated_user
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.chat_service import process_chat


router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    authenticated_user: AuthenticatedUser = Depends(get_authenticated_user),
) -> ChatResponse:
    return await process_chat(
        request,
        user_id=authenticated_user.user_id,
        supabase_client=authenticated_user.supabase,
    )