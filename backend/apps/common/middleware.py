"""Request correlation and security-header middleware."""

from __future__ import annotations

import logging
import re
import time
import uuid
from collections.abc import Callable

from django.http import HttpRequest, HttpResponse

from .logging import request_id_var

logger = logging.getLogger("healthos.request")

_VALID_REQUEST_ID = re.compile(r"^[A-Za-z0-9\-]{8,64}$")


class RequestIDMiddleware:
    """Attach a correlation ID to each request, log line and response.

    An inbound ``X-Request-ID`` is honoured only if it is well-formed, so callers
    cannot inject arbitrary content into logs.
    """

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        incoming = request.headers.get("X-Request-ID", "")
        request_id = incoming if _VALID_REQUEST_ID.match(incoming) else uuid.uuid4().hex
        request.request_id = request_id  # type: ignore[attr-defined]
        token = request_id_var.set(request_id)
        started = time.monotonic()
        try:
            response = self.get_response(request)
        finally:
            request_id_var.reset(token)
        duration_ms = round((time.monotonic() - started) * 1000, 1)
        response["X-Request-ID"] = request_id
        if request.path.startswith("/api/"):
            logger.info(
                "request",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.path,
                    "status": response.status_code,
                    "duration_ms": duration_ms,
                },
            )
        return response


class SecurityHeadersMiddleware:
    """Headers appropriate for a JSON API that never renders HTML for users."""

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        response = self.get_response(request)
        if request.path.startswith("/api/v1/docs") or request.path.startswith("/api/v1/redoc"):
            return response
        response.setdefault("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
        response.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        response.setdefault("Cross-Origin-Resource-Policy", "same-origin")
        response.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        if request.path.startswith("/api/") and "Cache-Control" not in response:
            response["Cache-Control"] = "no-store"
        return response
