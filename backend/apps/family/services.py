from __future__ import annotations

from django.conf import settings
from django.db import IntegrityError, transaction
from django.http import HttpRequest
from django.utils import timezone

from apps.accounts.models import User
from apps.audit.models import AuditEvent
from apps.audit.services import record_event
from apps.common.exceptions import ServiceError
from apps.notifications.email import frontend_link, queue_email
from apps.notifications.models import NotificationCategory
from apps.notifications.services import notify
from apps.profiles.access import normalize_permissions
from apps.profiles.models import PatientProfile

from .models import CaregiverAccess


def invite_caregiver(
    *,
    profile: PatientProfile,
    granted_by: User,
    email: str,
    relationship: str,
    permissions: list[str],
    expires_at,
    request: HttpRequest,  # type: ignore[no-untyped-def]
) -> CaregiverAccess:
    email = email.strip().lower()
    if email == granted_by.email.lower():
        raise ServiceError("You can't invite yourself as a caregiver.", code="INVALID_INVITE")
    if not permissions:
        raise ServiceError(
            "Choose at least one permission.",
            code="VALIDATION_ERROR",
            fields={"permissions": ["Choose at least one permission."]},
        )
    existing_user = User.objects.filter(email__iexact=email).first()
    if (
        existing_user
        and CaregiverAccess.objects.filter(
            profile=profile, caregiver=existing_user, status=CaregiverAccess.Status.ACTIVE
        ).exists()
    ):
        raise ServiceError(
            "This person already has caregiver access to this profile.", code="ALREADY_CAREGIVER"
        )
    try:
        with transaction.atomic():
            grant = CaregiverAccess.objects.create(
                profile=profile,
                granted_by=granted_by,
                invite_email=email,
                relationship=relationship,
                permissions=normalize_permissions(permissions),
                invite_expires_at=timezone.now() + settings.CAREGIVER_INVITE_LIFETIME,
                expires_at=expires_at,
            )
    except IntegrityError as exc:
        raise ServiceError(
            "An invitation for this email is already pending.", code="INVITE_PENDING"
        ) from exc
    record_event(
        AuditEvent.CAREGIVER_INVITED,
        request=request,
        target=grant,
        profile_id=profile.id,
        metadata={"permissions": grant.permissions, "invitee_known": bool(existing_user)},
    )
    queue_email(
        to=email,
        subject=f"{granted_by.full_name} invited you to help manage health information",
        body=(
            f"{granted_by.full_name} invited you to be a caregiver on HealthOS for "
            f"{profile.full_name}.\n\nSign in or create an account with this email address to "
            f"review the invitation:\n{frontend_link('/family/invitations')}\n\n"
            "The invitation expires in 7 days.\n\n— HealthOS"
        ),
    )
    if existing_user:
        notify(
            existing_user,
            category=NotificationCategory.SHARING,
            title="Caregiver invitation",
            body=f"{granted_by.full_name} invited you to help manage {profile.full_name}'s "
            "health information.",
            link="/family/invitations",
        )
    return grant


def pending_invitations_for(user: User):  # type: ignore[no-untyped-def]
    if not user.is_email_verified:
        return CaregiverAccess.objects.none()
    return CaregiverAccess.objects.filter(
        invite_email__iexact=user.email,
        status=CaregiverAccess.Status.PENDING,
        invite_expires_at__gt=timezone.now(),
    ).select_related("profile", "granted_by")


def respond_to_invitation(
    *, grant_id, user: User, accept: bool, request: HttpRequest  # type: ignore[no-untyped-def]
) -> CaregiverAccess:
    with transaction.atomic():
        grant = pending_invitations_for(user).select_for_update().filter(id=grant_id).first()
        if grant is None:
            raise ServiceError(
                "This invitation is no longer available.", code="NOT_FOUND", status_code=404
            )
        if grant.granted_by_id == user.id:
            raise ServiceError("You can't accept your own invitation.", code="INVALID_INVITE")
        if accept:
            # Replace any older active grant for this pair.
            CaregiverAccess.objects.filter(
                profile=grant.profile, caregiver=user, status=CaregiverAccess.Status.ACTIVE
            ).update(status=CaregiverAccess.Status.REVOKED, revoked_at=timezone.now())
            grant.caregiver = user
            grant.status = CaregiverAccess.Status.ACTIVE
            grant.accepted_at = timezone.now()
        else:
            grant.status = CaregiverAccess.Status.DECLINED
        grant.save()
    if accept:
        record_event(
            AuditEvent.CAREGIVER_ACCEPTED,
            request=request,
            target=grant,
            profile_id=grant.profile_id,
        )
        notify(
            grant.granted_by,
            category=NotificationCategory.SHARING,
            title="Caregiver invitation accepted",
            body=f"{user.full_name} can now help manage {grant.profile.full_name}'s "
            "health information.",
            link="/family",
        )
    return grant


def update_grant(
    *,
    grant: CaregiverAccess,
    permissions: list[str] | None,  # type: ignore[no-untyped-def]
    relationship: str | None,
    expires_at,
    request: HttpRequest,
    expires_at_provided: bool,
) -> CaregiverAccess:
    changed: list[str] = []
    if permissions is not None:
        if not permissions:
            raise ServiceError(
                "Choose at least one permission.",
                code="VALIDATION_ERROR",
                fields={"permissions": ["Choose at least one permission."]},
            )
        grant.permissions = normalize_permissions(permissions)
        changed.append("permissions")
    if relationship is not None:
        grant.relationship = relationship
        changed.append("relationship")
    if expires_at_provided:
        grant.expires_at = expires_at
        changed.append("expires_at")
    grant.save()
    record_event(
        AuditEvent.CAREGIVER_PERMISSIONS_CHANGED,
        request=request,
        target=grant,
        profile_id=grant.profile_id,
        metadata={"fields": changed, "permissions": grant.permissions},
    )
    return grant


def revoke_grant(
    *,
    grant: CaregiverAccess,
    request: HttpRequest | None,  # type: ignore[no-untyped-def]
    actor: User,
) -> None:
    if grant.status in (CaregiverAccess.Status.REVOKED, CaregiverAccess.Status.DECLINED):
        return
    grant.status = CaregiverAccess.Status.REVOKED
    grant.revoked_at = timezone.now()
    grant.save(update_fields=["status", "revoked_at", "updated_at"])
    record_event(
        AuditEvent.CAREGIVER_REVOKED,
        request=request,
        actor=actor,
        target=grant,
        profile_id=grant.profile_id,
    )
    if grant.caregiver_id and grant.caregiver_id != actor.id:
        notify(
            grant.caregiver,
            category=NotificationCategory.SHARING,
            title="Caregiver access ended",
            body=f"Your access to {grant.profile.full_name}'s health information has ended.",
            link="/family",
        )


def revoke_all_grants_for_owner(owner: User) -> int:
    return CaregiverAccess.objects.filter(
        profile__owner=owner,
        status__in=[CaregiverAccess.Status.ACTIVE, CaregiverAccess.Status.PENDING],
    ).update(status=CaregiverAccess.Status.REVOKED, revoked_at=timezone.now())
