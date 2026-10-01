from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies.auth import AuthenticatedUser, get_authenticated_user


router = APIRouter(
    prefix="/conversations",
    tags=["Conversations"],
)


@router.get("")
async def get_conversations(
    authenticated_user: AuthenticatedUser = Depends(get_authenticated_user),
):
    result = (
        authenticated_user.supabase
        .table("conversations")
        .select("id,title,created_at")
        .eq("user_id", authenticated_user.user_id)
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )

    return {
        "conversations": result.data
    }


@router.get("/{conversation_id}/messages")
async def get_conversation_messages(
    conversation_id: str,
    authenticated_user: AuthenticatedUser = Depends(get_authenticated_user),
):
    conversation_result = (
        authenticated_user.supabase
        .table("conversations")
        .select("id")
        .eq("id", conversation_id)
        .eq("user_id", authenticated_user.user_id)
        .limit(1)
        .execute()
    )
    if not conversation_result.data:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found.",
        )

    result = (
        authenticated_user.supabase
        .table("messages")
        .select("id,role,content,created_at")
        .eq("conversation_id", conversation_id)
        .order("created_at", desc=False)
        .execute()
    )

    if result.data is None:
        raise HTTPException(
            status_code=404,
            detail="Conversation messages not found.",
        )

    return {
        "messages": result.data
    }