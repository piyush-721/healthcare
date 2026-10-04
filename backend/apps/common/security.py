"""Small security helpers shared across apps."""

from __future__ import annotations

import hashlib
import hmac
import secrets

from django.conf import settings
from django.http import HttpRequest


def generate_token(nbytes: int = 32) -> str:
    return secrets.token_urlsafe(nbytes)


def hash_token(token: str) -> str:
    """Keyed hash for storing bearer secrets; raw tokens are never persisted."""
    return hmac.new(settings.SECRET_KEY.encode(), token.encode(), hashlib.sha256).hexdigest()


def client_ip(request: HttpRequest) -> str | None:
    # REMOTE_ADDR is authoritative; behind a trusted proxy configure it to set REMOTE_ADDR.
    return request.META.get("REMOTE_ADDR")


def user_agent(request: HttpRequest) -> str:
    return request.META.get("HTTP_USER_AGENT", "")[:255]
