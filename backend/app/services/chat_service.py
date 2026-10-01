from fastapi import HTTPException
from supabase import Client

from app.schemas.chat import ChatMessage, ChatRequest, ChatResponse
from app.services.ai_service import generate_ai_response


MAX_HISTORY_MESSAGES = 50


async def process_chat(
    request: ChatRequest,
    *,
    user_id: str,
    supabase_client: Client,
) -> ChatResponse:
    history: list[ChatMessage] = []

    # --------------------------------------------------
    # 1. Get existing conversation OR create a new one
    # --------------------------------------------------

    if request.conversation_id:
        conversation_id = request.conversation_id

        conversation_result = (
            supabase_client
            .table("conversations")
            .select("id")
            .eq("id", conversation_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )

        if not conversation_result.data:
            raise HTTPException(
                status_code=404,
                detail="Conversation not found.",
            )

        history_result = (
            supabase_client
            .table("messages")
            .select("role,content")
            .eq("conversation_id", conversation_id)
            .order("created_at", desc=True)
            .limit(MAX_HISTORY_MESSAGES)
            .execute()
        )
        history = [
            ChatMessage.model_validate(message)
            for message in reversed(history_result.data or [])
        ]

    else:
        conversation_result = (
            supabase_client
            .table("conversations")
            .insert({
                "title": request.message[:100],
                "user_id": user_id,
            })
            .execute()
        )

        if not conversation_result.data:
            raise RuntimeError("Failed to create conversation.")

        conversation = conversation_result.data[0]
        conversation_id = conversation["id"]

    # --------------------------------------------------
    # 2. Save user's message
    # --------------------------------------------------

    user_message_result = (
        supabase_client
        .table("messages")
        .insert({
            "conversation_id": conversation_id,
            "role": "user",
            "content": request.message,
        })
        .execute()
    )

    if not user_message_result.data:
        raise RuntimeError("Failed to save user message.")

    # --------------------------------------------------
    # 3. Generate AI response
    # --------------------------------------------------

    response = await generate_ai_response(
        message=request.message,
        mode=request.mode,
        history=history,
    )

    # --------------------------------------------------
    # 4. Save AI response
    # --------------------------------------------------

    assistant_message_result = (
        supabase_client
        .table("messages")
        .insert({
            "conversation_id": conversation_id,
            "role": "assistant",
            "content": response,
        })
        .execute()
    )

    if not assistant_message_result.data:
        raise RuntimeError("Failed to save assistant message.")

    # --------------------------------------------------
    # 5. Return response
    # --------------------------------------------------

    return ChatResponse(
        response=response,
        mode=request.mode,
        conversation_id=conversation_id,
    )