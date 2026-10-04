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
    """Client IP, honouring X-Forwarded-For only for the configured number of trusted proxies.

    Mirrors DRF's throttle identification so audit logs and rate limits agree.
    """
    num_proxies = settings.REST_FRAMEWORK.get("NUM_PROXIES") or 0
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if num_proxies > 0 and forwarded:
        addresses = [part.strip() for part in forwarded.split(",") if part.strip()]
        if addresses:
            return addresses[-min(num_proxies, len(addresses))]
    return request.META.get("REMOTE_ADDR")


def user_agent(request: HttpRequest) -> str:
    return request.META.get("HTTP_USER_AGENT", "")[:255]
