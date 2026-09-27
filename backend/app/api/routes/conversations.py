from fastapi import APIRouter, HTTPException

from app.database.supabase_client import supabase


router = APIRouter(
    prefix="/conversations",
    tags=["Conversations"],
)


@router.get("")
async def get_conversations():
    result = (
        supabase
        .table("conversations")
        .select("id,title,created_at")
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )

    return {
        "conversations": result.data
    }


@router.get("/{conversation_id}/messages")
async def get_conversation_messages(conversation_id: str):
    result = (
        supabase
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