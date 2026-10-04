"""Account and session business logic. Views stay thin and call into here."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import password_validation
from django.db import transaction
from django.http import HttpRequest
from django.utils import timezone
from rest_framework import status

from apps.audit.models import AuditEvent
from apps.audit.services import record_event
from apps.common.exceptions import ServiceError
from apps.common.security import client_ip, generate_token, hash_token, user_agent

from . import emails
from .models import AccountToken, AuthSession, User
from .tokens import AccessToken, issue_access_token

REFRESH_RACE_GRACE = timedelta(seconds=30)

_TOKEN_LIFETIMES = {
    AccountToken.Purpose.VERIFY_EMAIL: "EMAIL_VERIFICATION_TOKEN_LIFETIME",
    AccountToken.Purpose.RESET_PASSWORD: "PASSWORD_RESET_TOKEN_LIFETIME",
    AccountToken.Purpose.REACTIVATE: "ACCOUNT_REACTIVATION_TOKEN_LIFETIME",
}


@dataclass(frozen=True)
class IssuedSession:
    user: User
    session: AuthSession
    refresh_token: str
    access: AccessToken


def find_user_by_email(email: str) -> User | None:
    return User.objects.filter(email__iexact=email.strip()).first()


# ---------------------------------------------------------------------------
# One-time account tokens
# ---------------------------------------------------------------------------
def issue_account_token(user: User, purpose: str) -> str:
    """Create a fresh token, invalidating any earlier unused token of the same purpose."""
    now = timezone.now()
    AccountToken.objects.filter(user=user, purpose=purpose, used_at__isnull=True).update(
        used_at=now
    )
    raw = generate_token()
    lifetime = getattr(settings, _TOKEN_LIFETIMES[AccountToken.Purpose(purpose)])
    AccountToken.objects.create(
        user=user, purpose=purpose, token_hash=hash_token(raw), expires_at=now + lifetime
    )
    return raw


def consume_account_token(raw: str, purpose: str) -> User:
    with transaction.atomic():
        token = (
            AccountToken.objects.select_for_update()
            .select_related("user")
            .filter(token_hash=hash_token(raw or ""), purpose=purpose)
            .first()
        )
        if token is None or token.used_at is not None or token.expires_at <= timezone.now():
            raise ServiceError(
                "This link is invalid or has expired. Please request a new one.",
                code="INVALID_TOKEN",
            )
        token.used_at = timezone.now()
        token.save(update_fields=["used_at", "updated_at"])
        return token.user


# ---------------------------------------------------------------------------
# Registration & verification
# ---------------------------------------------------------------------------
def register_user(
    *, email: str, password: str, full_name: str, tz: str, request: HttpRequest
) -> User | None:
    """Register a new account.

    Returns ``None`` if the email is already registered. The API responds
    identically in both cases so that sign-up cannot be used to enumerate accounts.
    """
    from apps.profiles.services import create_self_profile

    existing = find_user_by_email(email)
    if existing is not None:
        emails.send_existing_account_email(existing)
        return None

    candidate = User(email=email.lower(), full_name=full_name)
    password_validation.validate_password(password, user=candidate)
    with transaction.atomic():
        user = User.objects.create_user(
            email=email, password=password, full_name=full_name, timezone=tz
        )
        create_self_profile(user)
        record_event(AuditEvent.SIGNUP, request=request, actor=user)
        token = issue_account_token(user, AccountToken.Purpose.VERIFY_EMAIL)
        emails.send_verification_email(user, token)
    return user


def resend_verification(email: str) -> None:
    user = find_user_by_email(email)
    if user is not None and not user.is_email_verified and user.is_active:
        emails.send_verification_email(
            user, issue_account_token(user, AccountToken.Purpose.VERIFY_EMAIL)
        )


def verify_email(raw_token: str, request: HttpRequest) -> User:
    user = consume_account_token(raw_token, AccountToken.Purpose.VERIFY_EMAIL)
    if not user.is_email_verified:
        user.email_verified_at = timezone.now()
        user.save(update_fields=["email_verified_at"])
        record_event(AuditEvent.EMAIL_VERIFIED, request=request, actor=user)
    return user


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------
def _new_session(user: User, request: HttpRequest) -> IssuedSession:
    raw = generate_token(48)
    session = AuthSession.objects.create(
        user=user,
        token_hash=hash_token(raw),
        expires_at=timezone.now() + settings.AUTH_REFRESH_TOKEN_LIFETIME,
        ip_address=client_ip(request),
        user_agent=user_agent(request),
    )
    access = issue_access_token(user_id=user.id, session_id=session.id)
    return IssuedSession(user=user, session=session, refresh_token=raw, access=access)


def login(*, email: str, password: str, request: HttpRequest) -> IssuedSession:
    user = find_user_by_email(email)
    if user is None or not user.check_password(password):
        record_event(
            AuditEvent.LOGIN_FAILED,
            request=request,
            actor=None,
            subject_user=user,
            metadata={"reason": "bad_credentials"},
        )
        raise ServiceError(
            "Incorrect email or password.",
            code="INVALID_CREDENTIALS",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )
    if user.status == User.Status.SUSPENDED:
        raise ServiceError(
            "This account has been suspended. Contact support for help.",
            code="ACCOUNT_SUSPENDED",
            status_code=status.HTTP_403_FORBIDDEN,
        )
    if user.status == User.Status.DEACTIVATED:
        raise ServiceError(
            "This account is deactivated. You can request a reactivation link.",
            code="ACCOUNT_DEACTIVATED",
            status_code=status.HTTP_403_FORBIDDEN,
        )
    if not user.is_email_verified:
        raise ServiceError(
            "Please verify your email address before signing in.",
            code="EMAIL_NOT_VERIFIED",
            status_code=status.HTTP_403_FORBIDDEN,
        )
    issued = _new_session(user, request)
    user.last_login = timezone.now()
    user.save(update_fields=["last_login"])
    record_event(
        AuditEvent.LOGIN, request=request, actor=user, metadata={"session": str(issued.session.id)}
    )
    return issued


def refresh_session(raw_token: str | None, request: HttpRequest) -> IssuedSession:
    invalid = ServiceError(
        "Your session has ended. Please sign in again.",
        code="SESSION_EXPIRED",
        status_code=status.HTTP_401_UNAUTHORIZED,
    )
    if not raw_token:
        raise invalid
    token_hash = hash_token(raw_token)
    now = timezone.now()
    with transaction.atomic():
        session = (
            AuthSession.objects.select_for_update()
            .select_related("user")
            .filter(token_hash=token_hash)
            .first()
        )
        if session is not None and session.is_valid and session.user.is_active:
            new_raw = generate_token(48)
            session.previous_token_hash = session.token_hash
            session.token_hash = hash_token(new_raw)
            session.rotated_at = now
            session.last_used_at = now
            session.ip_address = client_ip(request)
            session.user_agent = user_agent(request)
            session.save()
    if session is None:
        # Revocation must commit, so it happens outside the atomic block above.
        _handle_possible_token_reuse(token_hash, now, request)
        raise invalid
    if not session.is_valid or not session.user.is_active:
        raise invalid
    access = issue_access_token(user_id=session.user_id, session_id=session.id)
    return IssuedSession(user=session.user, session=session, refresh_token=new_raw, access=access)


def _handle_possible_token_reuse(token_hash: str, now, request: HttpRequest) -> None:  # type: ignore[no-untyped-def]
    reused = (
        AuthSession.objects.select_related("user")
        .filter(previous_token_hash=token_hash, revoked_at__isnull=True)
        .first()
    )
    if reused is None:
        return
    if reused.rotated_at and now - reused.rotated_at <= REFRESH_RACE_GRACE:
        # Two tabs refreshed at once; the browser already holds the new cookie.
        raise ServiceError(
            "Session refresh is already in progress.",
            code="REFRESH_CONFLICT",
            status_code=status.HTTP_409_CONFLICT,
        )
    reused.revoke("token_reuse")
    record_event(
        AuditEvent.REFRESH_TOKEN_REUSE,
        request=request,
        actor=reused.user,
        metadata={"session": str(reused.id)},
    )


def logout(raw_token: str | None, request: HttpRequest) -> None:
    if not raw_token:
        return
    session = (
        AuthSession.objects.select_related("user").filter(token_hash=hash_token(raw_token)).first()
    )
    if session is not None and session.revoked_at is None:
        session.revoke("logout")
        record_event(
            AuditEvent.LOGOUT,
            request=request,
            actor=session.user,
            metadata={"session": str(session.id)},
        )


def revoke_all_sessions(user: User, *, reason: str, except_session_id: object = None) -> int:
    qs = AuthSession.objects.filter(user=user, revoked_at__isnull=True)
    if except_session_id is not None:
        qs = qs.exclude(id=except_session_id)
    return qs.update(revoked_at=timezone.now(), revoke_reason=reason)


# ---------------------------------------------------------------------------
# Passwords & account status
# ---------------------------------------------------------------------------
def request_password_reset(email: str, request: HttpRequest) -> None:
    user = find_user_by_email(email)
    if user is None or user.status == User.Status.SUSPENDED:
        return
    record_event(
        AuditEvent.PASSWORD_RESET_REQUESTED, request=request, actor=None, subject_user=user
    )
    emails.send_password_reset_email(
        user, issue_account_token(user, AccountToken.Purpose.RESET_PASSWORD)
    )


def reset_password(raw_token: str, new_password: str, request: HttpRequest) -> None:
    with transaction.atomic():
        user = consume_account_token(raw_token, AccountToken.Purpose.RESET_PASSWORD)
        password_validation.validate_password(new_password, user=user)
        user.set_password(new_password)
        user.password_changed_at = timezone.now()
        # Completing a reset proves control of the mailbox.
        if not user.is_email_verified:
            user.email_verified_at = timezone.now()
        user.save()
        revoke_all_sessions(user, reason="password_reset")
        record_event(AuditEvent.PASSWORD_RESET, request=request, actor=user)
    _security_notice(user, "Your HealthOS password was reset and all devices were signed out.")


def change_password(
    user: User,
    *,
    current_password: str,
    new_password: str,
    session: AuthSession | None,
    request: HttpRequest,
) -> None:
    if not user.check_password(current_password):
        raise ServiceError(
            "The request contains invalid data.",
            code="VALIDATION_ERROR",
            fields={"current_password": ["Your current password is incorrect."]},
        )
    password_validation.validate_password(new_password, user=user)
    with transaction.atomic():
        user.set_password(new_password)
        user.password_changed_at = timezone.now()
        user.save()
        revoke_all_sessions(
            user,
            reason="password_changed",
            except_session_id=session.id if session else None,
        )
        record_event(AuditEvent.PASSWORD_CHANGED, request=request, actor=user)
    _security_notice(user, "Your HealthOS password was changed. Other devices were signed out.")


def deactivate_account(user: User, *, password: str, request: HttpRequest) -> None:
    if not user.check_password(password):
        raise ServiceError(
            "The request contains invalid data.",
            code="VALIDATION_ERROR",
            fields={"password": ["Your password is incorrect."]},
        )
    with transaction.atomic():
        user.set_status(User.Status.DEACTIVATED)
        user.save(update_fields=["status", "status_changed_at"])
        revoke_all_sessions(user, reason="deactivated")
        _revoke_outgoing_access(user)
        record_event(AuditEvent.ACCOUNT_DEACTIVATED, request=request, actor=user)


def _revoke_outgoing_access(user: User) -> None:
    """Deactivation stops every share and caregiver grant the user created."""
    from apps.family.services import revoke_all_grants_for_owner
    from apps.sharing.services import revoke_all_shares_for_owner

    revoke_all_shares_for_owner(user)
    revoke_all_grants_for_owner(user)


def request_reactivation(email: str) -> None:
    user = find_user_by_email(email)
    if user is not None and user.status == User.Status.DEACTIVATED:
        emails.send_reactivation_email(
            user, issue_account_token(user, AccountToken.Purpose.REACTIVATE)
        )


def reactivate_account(raw_token: str, request: HttpRequest) -> User:
    with transaction.atomic():
        user = consume_account_token(raw_token, AccountToken.Purpose.REACTIVATE)
        if user.status != User.Status.DEACTIVATED:
            raise ServiceError(
                "This account cannot be reactivated with this link.", code="INVALID_TOKEN"
            )
        user.set_status(User.Status.ACTIVE)
        user.save(update_fields=["status", "status_changed_at"])
        record_event(AuditEvent.ACCOUNT_REACTIVATED, request=request, actor=user)
    return user


def _security_notice(user: User, message: str) -> None:
    from apps.notifications.models import NotificationCategory
    from apps.notifications.services import notify

    notify(
        user,
        category=NotificationCategory.SECURITY,
        title="Security notice",
        body=message,
        link="/settings/security",
    )
