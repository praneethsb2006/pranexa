from app.schemas.chat import ChatRequest, ChatResponse
from app.services.ai_service import generate_ai_response


async def process_chat(request: ChatRequest) -> ChatResponse:
    """
    Process a user's chat request and return a structured response.
    """

    response = await generate_ai_response(
        message=request.message,
        mode=request.mode,
    )

    return ChatResponse(
        response=response,
        mode=request.mode,
    )