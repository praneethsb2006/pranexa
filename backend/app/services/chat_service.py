from app.database.supabase_client import supabase
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.ai_service import generate_ai_response


async def process_chat(request: ChatRequest) -> ChatResponse:

    # --------------------------------------------------
    # 1. Get existing conversation OR create a new one
    # --------------------------------------------------

    if request.conversation_id:
        # Continue an existing conversation
        conversation_id = request.conversation_id

    else:
        # Create a brand-new conversation
        conversation_result = (
            supabase
            .table("conversations")
            .insert({
                "title": request.message[:100],
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
        supabase
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
        history=request.history,
    )

    # --------------------------------------------------
    # 4. Save AI response
    # --------------------------------------------------

    assistant_message_result = (
        supabase
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