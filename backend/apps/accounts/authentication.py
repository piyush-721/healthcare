"""DRF authentication using ``Authorization: Bearer <access token>``.

Every request re-validates the backing session, so logout, password reset,
suspension and "log out everywhere" take effect immediately rather than when
the access token expires.
"""

from __future__ import annotations

import jwt
from django.middleware.csrf import CsrfViewMiddleware
from django.utils import timezone
from rest_framework import authentication, exceptions
from rest_framework.request import Request

from .models import AuthSession, User
from .tokens import decode_access_token


class AccessTokenAuthentication(authentication.BaseAuthentication):
    keyword = "Bearer"

    def authenticate(self, request: Request) -> tuple[User, AuthSession] | None:
        header = authentication.get_authorization_header(request).decode("latin-1")
        if not header:
            return None
        parts = header.split()
        if len(parts) != 2 or parts[0] != self.keyword:
            raise exceptions.AuthenticationFailed("Invalid authorization header.")
        try:
            claims = decode_access_token(parts[1])
        except jwt.ExpiredSignatureError as exc:
            raise exceptions.AuthenticationFailed(
                "Access token expired.", code="token_expired"
            ) from exc
        except jwt.InvalidTokenError as exc:
            raise exceptions.AuthenticationFailed("Invalid access token.") from exc

        session = (
            AuthSession.objects.select_related("user")
            .filter(
                id=claims["sid"],
                user_id=claims["sub"],
                revoked_at__isnull=True,
                expires_at__gt=timezone.now(),
            )
            .first()
        )
        if session is None or not session.user.is_active:
            raise exceptions.AuthenticationFailed("Session is no longer valid.")
        return session.user, session

    def authenticate_header(self, request: Request) -> str:
        return self.keyword


class _CSRFCheck(CsrfViewMiddleware):
    def _reject(self, request, reason):  # type: ignore[no-untyped-def]
        return reason


def enforce_csrf(request: Request) -> None:
    """Double-submit CSRF check for endpoints that rely on the refresh cookie."""
    check = _CSRFCheck(lambda _request: None)  # type: ignore[arg-type]
    check.process_request(request)
    reason = check.process_view(request, None, (), {})
    if reason:
        raise exceptions.PermissionDenied(f"CSRF validation failed: {reason}")
