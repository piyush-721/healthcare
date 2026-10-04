"""Short-lived JWT access tokens bound to a refresh session."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

import jwt
from django.conf import settings
from django.utils import timezone

ALGORITHM = "HS256"


@dataclass(frozen=True)
class AccessToken:
    token: str
    expires_at: datetime


def issue_access_token(*, user_id: Any, session_id: Any) -> AccessToken:
    now = timezone.now()
    expires_at = now + settings.AUTH_ACCESS_TOKEN_LIFETIME
    payload = {
        "iss": settings.AUTH_JWT_ISSUER,
        "sub": str(user_id),
        "sid": str(session_id),
        "typ": "access",
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    token = jwt.encode(payload, settings.AUTH_JWT_SIGNING_KEY, algorithm=ALGORITHM)
    return AccessToken(token=token, expires_at=expires_at)


def decode_access_token(token: str) -> dict[str, Any]:
    payload = jwt.decode(
        token,
        settings.AUTH_JWT_SIGNING_KEY,
        algorithms=[ALGORITHM],
        issuer=settings.AUTH_JWT_ISSUER,
        options={"require": ["exp", "iat", "sub", "sid", "iss"]},
    )
    if payload.get("typ") != "access":
        raise jwt.InvalidTokenError("Wrong token type.")
    return payload
