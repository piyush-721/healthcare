from __future__ import annotations

from datetime import timedelta

from django.db import transaction
from django.db.models import F
from django.http import HttpRequest
from django.utils import timezone
from rest_framework import status

from apps.accounts.models import User
from apps.audit.models import AuditEvent
from apps.audit.services import record_event
from apps.common.exceptions import ServiceError, ShareAccessDenied
from apps.common.security import client_ip, generate_token, hash_token, user_agent
from apps.notifications.email import frontend_link, queue_email
from apps.profiles.models import PatientProfile

from .models import DataShare, ShareAccessLog

MAX_SHARE_DURATION = timedelta(days=30)


def share_link(token: str) -> str:
    return frontend_link("/shared", token=token)


def create_share(
    *,
    profile: PatientProfile,
    created_by: User,
    recipient_name: str,
    recipient_email: str,
    purpose: str,
    scopes: list[str],
    duration_hours: int,
    send_email: bool,
    request: HttpRequest,
) -> tuple[DataShare, str]:
    if profile.owner_id != created_by.id:
        # Caregivers cannot re-share someone else's information.
        raise ServiceError(
            "Only the profile owner can share this information.",
            code="PERMISSION_DENIED",
            status_code=status.HTTP_403_FORBIDDEN,
        )
    duration = timedelta(hours=duration_hours)
    if duration > MAX_SHARE_DURATION:
        raise ServiceError(
            "Shares can last at most 30 days.",
            code="VALIDATION_ERROR",
            fields={"duration_hours": ["Shares can last at most 30 days."]},
        )
    raw = generate_token(32)
    with transaction.atomic():
        share = DataShare.objects.create(
            profile=profile,
            created_by=created_by,
            recipient_name=recipient_name,
            recipient_email=recipient_email,
            purpose=purpose,
            scopes=sorted(set(scopes)),
            token_hash=hash_token(raw),
            expires_at=timezone.now() + duration,
        )
        record_event(
            AuditEvent.SHARE_CREATED,
            request=request,
            target=share,
            metadata={
                "scopes": share.scopes,
                "duration_hours": duration_hours,
                "emailed": bool(send_email and recipient_email),
            },
        )
    if send_email and recipient_email:
        queue_email(
            to=recipient_email,
            subject=f"{created_by.full_name} shared health information with you",
            body=(
                f"Hello {recipient_name},\n\n{created_by.full_name} has shared selected health "
                f"information for {profile.full_name} with you via HealthOS.\n\n"
                f"Open the secure link (valid until {share.expires_at:%d %b %Y %H:%M} UTC):\n"
                f"{share_link(raw)}\n\nAccess can be revoked at any time and every view is "
                "logged.\n\n— HealthOS"
            ),
        )
    return share, raw


def revoke_share(share: DataShare, *, by: User, request: HttpRequest | None) -> DataShare:
    if share.revoked_at is None:
        share.revoked_at = timezone.now()
        share.revoked_by = by
        share.save(update_fields=["revoked_at", "revoked_by", "updated_at"])
        record_event(AuditEvent.SHARE_REVOKED, request=request, actor=by, target=share)
    return share


def revoke_all_shares_for_owner(owner: User) -> int:
    return DataShare.objects.filter(created_by=owner, revoked_at__isnull=True).update(
        revoked_at=timezone.now(), revoked_by=owner
    )


def _log(share: DataShare, outcome: str, section: str, request: HttpRequest) -> None:
    ShareAccessLog.objects.create(
        share=share,
        outcome=outcome,
        section=section[:40],
        ip_address=client_ip(request),
        user_agent=user_agent(request),
    )


def authorize_share_access(
    raw_token: str | None, section: str, any_of_scopes: tuple[str, ...] | None, request: HttpRequest
) -> DataShare:
    """Validate a share token for one section. Every attempt is logged.

    ``any_of_scopes`` — the share must include at least one of these scopes
    (``None`` for the summary, which only reveals what was shared).
    """
    share = None
    if raw_token:
        share = (
            DataShare.objects.select_related("profile", "created_by")
            .filter(token_hash=hash_token(raw_token))
            .first()
        )
    if share is None:
        record_event(
            AuditEvent.SHARE_ACCESS_DENIED,
            request=request,
            actor=None,
            metadata={"reason": "unknown_token", "section": section},
        )
        raise ShareAccessDenied(
            "This sharing link is invalid.",
            code="SHARE_NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    denial = None
    if share.revoked_at is not None:
        denial = (
            ShareAccessLog.Outcome.DENIED_REVOKED,
            "SHARE_REVOKED",
            "Access denied. This sharing permission has been revoked.",
        )
    elif share.expires_at <= timezone.now():
        denial = (
            ShareAccessLog.Outcome.DENIED_EXPIRED,
            "SHARE_EXPIRED",
            "Access denied. This sharing permission has expired.",
        )
    elif any_of_scopes is not None and not set(any_of_scopes) & set(share.scopes):
        denial = (
            ShareAccessLog.Outcome.DENIED_SCOPE,
            "SHARE_SCOPE_DENIED",
            "This information was not included in the share.",
        )
    if denial is not None:
        outcome, code, message = denial
        _log(share, outcome, section, request)
        record_event(
            AuditEvent.SHARE_ACCESS_DENIED,
            request=request,
            actor=None,
            subject_user=share.created_by,
            target=share,
            metadata={"reason": outcome, "section": section},
        )
        raise ShareAccessDenied(message, code=code)

    _log(share, ShareAccessLog.Outcome.GRANTED, section, request)
    DataShare.objects.filter(id=share.id).update(
        access_count=F("access_count") + 1, last_accessed_at=timezone.now()
    )
    record_event(
        AuditEvent.SHARED_RECORD_ACCESSED,
        request=request,
        actor=None,
        subject_user=share.created_by,
        target=share,
        metadata={"section": section},
    )
    return share
