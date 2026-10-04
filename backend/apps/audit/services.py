"""Audit recording API used by every app."""

from __future__ import annotations

import logging
from typing import Any

from django.http import HttpRequest

from apps.common.logging import request_id_var
from apps.common.security import client_ip, user_agent

from .models import AuditEvent, AuditLog

logger = logging.getLogger("healthos.audit")

# Keys that must never land in audit metadata even if a caller passes them.
_FORBIDDEN_KEYS = {"password", "token", "refresh_token", "access_token", "secret", "file"}


def record_event(
    event_type: AuditEvent | str,
    *,
    request: HttpRequest | None = None,
    actor: Any = None,
    subject_user: Any = None,
    profile_id: Any = None,
    target: Any = None,
    target_type: str = "",
    target_id: str = "",
    metadata: dict[str, Any] | None = None,
) -> AuditLog:
    if actor is None and request is not None:
        request_user = getattr(request, "user", None)
        if request_user is not None and getattr(request_user, "is_authenticated", False):
            actor = request_user
    if target is not None:
        target_type = target_type or target.__class__.__name__
        target_id = target_id or str(target.pk)
        if profile_id is None:
            profile_id = getattr(target, "profile_id", None)
    clean_metadata = {k: v for k, v in (metadata or {}).items() if k.lower() not in _FORBIDDEN_KEYS}
    entry = AuditLog.objects.create(
        event_type=str(event_type),
        actor=actor,
        subject_user=subject_user if subject_user is not None else actor,
        profile_id=profile_id,
        target_type=target_type,
        target_id=target_id,
        ip_address=client_ip(request) if request is not None else None,
        user_agent=user_agent(request) if request is not None else "",
        request_id=getattr(request, "request_id", "") or request_id_var.get().strip("-"),
        metadata=clean_metadata,
    )
    logger.info("audit", extra={"event_type": str(event_type), "audit_id": str(entry.id)})
    return entry
