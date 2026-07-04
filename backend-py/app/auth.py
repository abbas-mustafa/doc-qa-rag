"""Authentication: verifies Supabase-issued JWTs and yields the current user id.

Supports both Supabase signing schemes:
  - HS256 shared secret  (legacy projects) -> set SUPABASE_JWT_SECRET
  - Asymmetric ES256/RS256 via JWKS (current default) -> set SUPABASE_PROJECT_URL

When settings.auth_enabled is False the API runs open, attributing all data to a
fixed dev user so the multi-user code paths behave identically in dev and prod.
"""
from __future__ import annotations

import asyncio
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import settings

# Stable placeholder owner used when auth is disabled (local dev).
DEV_USER_ID = UUID("00000000-0000-0000-0000-000000000000")

_bearer = HTTPBearer(auto_error=False)

_jwks_client: jwt.PyJWKClient | None = None


def _get_jwks_client() -> jwt.PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        base = settings.supabase_project_url.rstrip("/")
        _jwks_client = jwt.PyJWKClient(f"{base}/auth/v1/.well-known/jwks.json")
    return _jwks_client


def _decode_hs256(token: str) -> dict:
    return jwt.decode(
        token,
        settings.supabase_jwt_secret,
        algorithms=["HS256"],
        audience="authenticated",
    )


def _decode_asymmetric(token: str) -> dict:
    signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=["ES256", "RS256"],
        audience="authenticated",
    )


async def _verify(token: str) -> dict:
    if settings.supabase_jwt_secret:
        return _decode_hs256(token)
    if settings.supabase_project_url:
        # JWKS lookup does (cached) network I/O; keep it off the event loop.
        return await asyncio.to_thread(_decode_asymmetric, token)
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Auth enabled but neither SUPABASE_JWT_SECRET nor SUPABASE_PROJECT_URL is set",
    )


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> UUID:
    if not settings.auth_enabled:
        return DEV_USER_ID

    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = await _verify(credentials.credentials)
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token missing subject")
    return UUID(sub)


CurrentUser = Depends(get_current_user_id)
