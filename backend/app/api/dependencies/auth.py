from collections.abc import Iterator
from dataclasses import dataclass

import httpx
from fastapi import Header, HTTPException
from supabase import AuthApiError, AuthRetryableError, Client

from app.database.supabase_client import create_user_supabase_client


@dataclass(frozen=True)
class AuthenticatedUser:
    user_id: str
    supabase: Client


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=401,
        detail="Invalid authentication credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_authenticated_user(
    authorization: str | None = Header(default=None),
) -> Iterator[AuthenticatedUser]:
    parts = authorization.split() if authorization else []
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise _unauthorized()

    access_token = parts[1]
    try:
        client = create_user_supabase_client(access_token)
    except RuntimeError:
        raise HTTPException(
            status_code=503,
            detail="Authentication service is not configured.",
        ) from None

    try:
        try:
            response = client.auth.get_user(access_token)
        except AuthApiError as error:
            if error.status in {400, 401, 403}:
                raise _unauthorized() from None
            raise HTTPException(
                status_code=503,
                detail="Authentication service is unavailable.",
            ) from None
        except (AuthRetryableError, httpx.HTTPError, TimeoutError, OSError):
            raise HTTPException(
                status_code=503,
                detail="Authentication service is unavailable.",
            ) from None

        user = response.user if response else None
        if user is None or not user.id:
            raise _unauthorized()

        yield AuthenticatedUser(
            user_id=user.id,
            supabase=client,
        )
    finally:
        client.auth.close()
