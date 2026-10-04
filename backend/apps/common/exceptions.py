"""Consistent API error envelope.

Every error response has the shape::

    {"error": {"code": "VALIDATION_ERROR", "message": "...", "fields": {...}}}

Stack traces and internal details are never returned to clients.
"""

from __future__ import annotations

import logging
from typing import Any

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger("healthos.errors")


class ServiceError(exceptions.APIException):
    """Domain error raised from service code with an explicit machine-readable code."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "BAD_REQUEST"
    default_detail = "The request could not be completed."

    def __init__(
        self,
        message: str | None = None,
        code: str | None = None,
        status_code: int | None = None,
        fields: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(detail=message or self.default_detail, code=code or self.default_code)
        if status_code is not None:
            self.status_code = status_code
        self.error_code = code or self.default_code
        self.fields = fields


class ShareAccessDenied(ServiceError):
    status_code = status.HTTP_403_FORBIDDEN
    default_code = "SHARE_ACCESS_DENIED"
    default_detail = "Access denied."


_DEFAULT_CODES: dict[type[Exception], tuple[str, str]] = {
    exceptions.NotAuthenticated: ("NOT_AUTHENTICATED", "Authentication is required."),
    exceptions.AuthenticationFailed: ("AUTHENTICATION_FAILED", "Authentication failed."),
    exceptions.PermissionDenied: (
        "PERMISSION_DENIED",
        "You do not have permission to perform this action.",
    ),
    exceptions.NotFound: ("NOT_FOUND", "The requested resource was not found."),
    exceptions.MethodNotAllowed: ("METHOD_NOT_ALLOWED", "Method not allowed."),
    exceptions.NotAcceptable: ("NOT_ACCEPTABLE", "Not acceptable."),
    exceptions.UnsupportedMediaType: ("UNSUPPORTED_MEDIA_TYPE", "Unsupported media type."),
    exceptions.Throttled: ("RATE_LIMITED", "Too many requests. Please try again later."),
    exceptions.ParseError: ("PARSE_ERROR", "The request body could not be parsed."),
}


def _normalize(detail: Any) -> Any:
    if isinstance(detail, dict):
        return {str(key): _normalize(value) for key, value in detail.items()}
    if isinstance(detail, list):
        if any(isinstance(item, dict) for item in detail):
            return [_normalize(item) for item in detail]
        return [str(item) for item in detail]
    return [str(detail)]


def _flatten_fields(detail: Any) -> dict[str, Any]:
    normalized = _normalize(detail)
    if isinstance(normalized, dict):
        return normalized
    return {"non_field_errors": normalized}


def api_exception_handler(exc: Exception, context: dict[str, Any]) -> Response | None:
    if isinstance(exc, Http404):
        exc = exceptions.NotFound()
    elif isinstance(exc, DjangoPermissionDenied):
        exc = exceptions.PermissionDenied()

    response = exception_handler(exc, context)
    if response is None:
        logger.exception("Unhandled API exception", exc_info=exc)
        return Response(
            {"error": {"code": "SERVER_ERROR", "message": "An unexpected error occurred."}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    error: dict[str, Any]
    if isinstance(exc, ServiceError):
        error = {"code": exc.error_code, "message": str(exc.detail)}
        if exc.fields:
            error["fields"] = exc.fields
    elif isinstance(exc, exceptions.ValidationError):
        error = {
            "code": "VALIDATION_ERROR",
            "message": "The request contains invalid data.",
            "fields": _flatten_fields(exc.detail),
        }
    else:
        code, message = next(
            (v for k, v in _DEFAULT_CODES.items() if isinstance(exc, k)),
            ("ERROR", "The request could not be completed."),
        )
        # Use DRF's message for well-known errors only when it was customised.
        if isinstance(exc.detail, str) and exc.detail != exc.default_detail:
            message = str(exc.detail)
        error = {"code": code, "message": message}
        if isinstance(exc, exceptions.Throttled) and exc.wait:
            error["retry_after_seconds"] = int(exc.wait)

    response.data = {"error": error}
    return response
