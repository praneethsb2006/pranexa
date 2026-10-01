import os

import httpx
from dotenv import load_dotenv
from supabase import Client, ClientOptions, create_client

load_dotenv()


SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_PUBLISHABLE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")


if not SUPABASE_URL:
    raise RuntimeError("SUPABASE_URL is not configured.")

if not SUPABASE_SECRET_KEY:
    raise RuntimeError("SUPABASE_SECRET_KEY is not configured.")


privileged_supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_SECRET_KEY,
)


def create_user_supabase_client(access_token: str) -> Client:
    if not SUPABASE_PUBLISHABLE_KEY:
        raise RuntimeError("SUPABASE_PUBLISHABLE_KEY is not configured.")

    http_client = httpx.Client()
    options = ClientOptions(
        auto_refresh_token=False,
        persist_session=False,
        httpx_client=http_client,
    )
    try:
        client = create_client(
            SUPABASE_URL,
            SUPABASE_PUBLISHABLE_KEY,
            options=options,
        )
        client.postgrest.auth(access_token)
        return client
    except BaseException:
        http_client.close()
        raise