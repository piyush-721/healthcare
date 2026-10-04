"""Identity, refresh sessions and one-time account tokens."""

from __future__ import annotations

import uuid
import zoneinfo

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone as dj_timezone

from apps.common.models import UUIDModel


def validate_timezone(value: str) -> None:
    if value not in zoneinfo.available_timezones():
        raise ValidationError("Unknown time zone.")


class UserManager(BaseUserManager["User"]):
    use_in_migrations = True

    def create_user(self, email: str, password: str | None = None, **extra: object) -> User:
        if not email:
            raise ValueError("Email is required.")
        user = self.model(email=self.normalize_email(email).lower(), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email: str, password: str | None = None, **extra: object) -> User:
        """Creates a *platform administrator*. Admins get no implicit health-data access."""
        extra.setdefault("role", User.Role.ADMIN)
        extra.setdefault("email_verified_at", dj_timezone.now())
        return self.create_user(email, password, **extra)


class User(AbstractBaseUser):
    class Role(models.TextChoices):
        USER = "USER", "User"
        ADMIN = "ADMIN", "Platform admin"

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        DEACTIVATED = "DEACTIVATED", "Deactivated by user"
        SUSPENDED = "SUSPENDED", "Suspended by admin"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(max_length=254, unique=True)
    full_name = models.CharField(max_length=150)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.USER)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.ACTIVE)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    timezone = models.CharField(max_length=64, default="UTC", validators=[validate_timezone])
    date_joined = models.DateTimeField(default=dj_timezone.now)
    status_changed_at = models.DateTimeField(null=True, blank=True)
    password_changed_at = models.DateTimeField(null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]

    class Meta:
        constraints = [
            models.UniqueConstraint(Lower("email"), name="accounts_user_email_ci_unique"),
        ]
        indexes = [models.Index(fields=["status", "role"], name="accounts_user_status_role_idx")]

    def __str__(self) -> str:
        return self.email

    @property
    def is_active(self) -> bool:  # type: ignore[override]
        return self.status == self.Status.ACTIVE

    @property
    def is_email_verified(self) -> bool:
        return self.email_verified_at is not None

    @property
    def is_platform_admin(self) -> bool:
        return self.role == self.Role.ADMIN and self.is_active

    def set_status(self, status: str) -> None:
        self.status = status
        self.status_changed_at = dj_timezone.now()


class AuthSession(UUIDModel):
    """A refresh-token session (one per device/browser login).

    Only keyed hashes of refresh tokens are stored. Tokens rotate on every
    refresh; presenting a rotated-out token outside the grace window is treated
    as theft and revokes the session.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="auth_sessions")
    token_hash = models.CharField(max_length=64, unique=True)
    previous_token_hash = models.CharField(max_length=64, blank=True, db_index=True)
    rotated_at = models.DateTimeField(null=True, blank=True)
    last_used_at = models.DateTimeField(default=dj_timezone.now)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoke_reason = models.CharField(max_length=40, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "revoked_at"], name="accounts_session_user_idx"),
            models.Index(fields=["expires_at"], name="accounts_session_expiry_idx"),
        ]

    @property
    def is_valid(self) -> bool:
        return self.revoked_at is None and self.expires_at > dj_timezone.now()

    def revoke(self, reason: str) -> None:
        if self.revoked_at is None:
            self.revoked_at = dj_timezone.now()
            self.revoke_reason = reason
            self.save(update_fields=["revoked_at", "revoke_reason", "updated_at"])


class AccountToken(UUIDModel):
    """Single-use, expiring token for email verification, password reset, reactivation."""

    class Purpose(models.TextChoices):
        VERIFY_EMAIL = "VERIFY_EMAIL"
        RESET_PASSWORD = "RESET_PASSWORD"
        REACTIVATE = "REACTIVATE"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="account_tokens")
    purpose = models.CharField(max_length=20, choices=Purpose.choices)
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "purpose", "used_at"], name="accounts_token_lookup_idx")
        ]
