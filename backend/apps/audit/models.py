"""Append-only audit trail for security- and health-data-sensitive events.

Entries contain identifiers and non-sensitive context only — never passwords,
tokens, file contents or clinical free text.
"""

import uuid

from django.conf import settings
from django.db import models


class AuditEvent(models.TextChoices):
    # Account & security
    SIGNUP = "SIGNUP"
    LOGIN = "LOGIN"
    LOGIN_FAILED = "LOGIN_FAILED"
    LOGOUT = "LOGOUT"
    LOGOUT_ALL = "LOGOUT_ALL"
    SESSION_REVOKED = "SESSION_REVOKED"
    REFRESH_TOKEN_REUSE = "REFRESH_TOKEN_REUSE"
    EMAIL_VERIFIED = "EMAIL_VERIFIED"
    PASSWORD_CHANGED = "PASSWORD_CHANGED"
    PASSWORD_RESET_REQUESTED = "PASSWORD_RESET_REQUESTED"
    PASSWORD_RESET = "PASSWORD_RESET"
    ACCOUNT_DEACTIVATED = "ACCOUNT_DEACTIVATED"
    ACCOUNT_REACTIVATED = "ACCOUNT_REACTIVATED"
    ACCOUNT_SUSPENDED = "ACCOUNT_SUSPENDED"
    ROLE_CHANGED = "ROLE_CHANGED"
    # Health data
    RECORD_CREATED = "RECORD_CREATED"
    RECORD_UPDATED = "RECORD_UPDATED"
    RECORD_DELETED = "RECORD_DELETED"
    DOCUMENT_UPLOADED = "DOCUMENT_UPLOADED"
    DOCUMENT_VIEWED = "DOCUMENT_VIEWED"
    DOCUMENT_ARCHIVED = "DOCUMENT_ARCHIVED"
    DOCUMENT_QUARANTINED = "DOCUMENT_QUARANTINED"
    # Family / caregivers
    CAREGIVER_INVITED = "CAREGIVER_INVITED"
    CAREGIVER_ACCEPTED = "CAREGIVER_ACCEPTED"
    CAREGIVER_PERMISSIONS_CHANGED = "CAREGIVER_PERMISSIONS_CHANGED"
    CAREGIVER_REVOKED = "CAREGIVER_REVOKED"
    # Sharing
    SHARE_CREATED = "SHARE_CREATED"
    SHARE_REVOKED = "SHARE_REVOKED"
    SHARED_RECORD_ACCESSED = "SHARED_RECORD_ACCESSED"
    SHARE_ACCESS_DENIED = "SHARE_ACCESS_DENIED"


SECURITY_EVENTS = {
    AuditEvent.SIGNUP,
    AuditEvent.LOGIN,
    AuditEvent.LOGIN_FAILED,
    AuditEvent.LOGOUT,
    AuditEvent.LOGOUT_ALL,
    AuditEvent.SESSION_REVOKED,
    AuditEvent.REFRESH_TOKEN_REUSE,
    AuditEvent.EMAIL_VERIFIED,
    AuditEvent.PASSWORD_CHANGED,
    AuditEvent.PASSWORD_RESET_REQUESTED,
    AuditEvent.PASSWORD_RESET,
    AuditEvent.ACCOUNT_DEACTIVATED,
    AuditEvent.ACCOUNT_REACTIVATED,
    AuditEvent.ACCOUNT_SUSPENDED,
    AuditEvent.ROLE_CHANGED,
}


class AuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    event_type = models.CharField(max_length=40, choices=AuditEvent.choices)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="audit_events",
    )
    # The account the event concerns (e.g. the user whose password was reset).
    subject_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="audit_events_about",
    )
    # Health profile whose data was touched, stored as a plain UUID so audit rows
    # outlive deleted profiles.
    profile_id = models.UUIDField(null=True, blank=True)
    target_type = models.CharField(max_length=60, blank=True)
    target_id = models.CharField(max_length=64, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, blank=True)
    request_id = models.CharField(max_length=64, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["actor", "-created_at"], name="audit_actor_created_idx"),
            models.Index(fields=["subject_user", "-created_at"], name="audit_subject_created_idx"),
            models.Index(fields=["profile_id", "-created_at"], name="audit_profile_created_idx"),
            models.Index(fields=["event_type", "-created_at"], name="audit_event_created_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.event_type} @ {self.created_at:%Y-%m-%d %H:%M}"

    def save(self, *args, **kwargs):  # type: ignore[no-untyped-def]
        if not self._state.adding:
            raise ValueError("Audit log entries are immutable.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):  # type: ignore[no-untyped-def]
        raise ValueError("Audit log entries cannot be deleted.")
