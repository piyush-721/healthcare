"""Consent-based, time-limited sharing with healthcare providers.

A share grants read-only access to selected sections of one profile. The
recipient receives a high-entropy link; only its keyed hash is stored. Access
stops at ``expires_at`` or immediately on revocation, and every attempt —
granted or denied — is logged.
"""

from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.db import models
from django.utils import timezone

from apps.profiles.models import ProfileOwnedModel


class ShareScope(models.TextChoices):
    PROFILE = "PROFILE", "Health profile (allergies, conditions, vaccinations, vitals)"
    MEDICATIONS = "MEDICATIONS", "Medications"
    APPOINTMENTS = "APPOINTMENTS", "Appointments"
    DOCUMENTS = "DOCUMENTS", "Medical records & documents"
    LAB_RESULTS = "LAB_RESULTS", "Lab reports"
    TREATMENT_PLANS = "TREATMENT_PLANS", "Treatment plans"
    FINANCIAL = "FINANCIAL", "Medical bills"


class DataShare(ProfileOwnedModel):
    class State(models.TextChoices):
        ACTIVE = "ACTIVE"
        EXPIRED = "EXPIRED"
        REVOKED = "REVOKED"

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="data_shares"
    )
    recipient_name = models.CharField(max_length=150)
    recipient_email = models.EmailField(blank=True)
    purpose = models.CharField(max_length=255, blank=True)
    scopes = ArrayField(models.CharField(max_length=20, choices=ShareScope.choices))
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    last_accessed_at = models.DateTimeField(null=True, blank=True)
    access_count = models.PositiveIntegerField(default=0)
    expiry_notified_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["profile", "-created_at"], name="share_profile_idx"),
            models.Index(fields=["expires_at"], name="share_expiry_idx"),
        ]

    @property
    def state(self) -> str:
        if self.revoked_at is not None:
            return self.State.REVOKED
        if self.expires_at <= timezone.now():
            return self.State.EXPIRED
        return self.State.ACTIVE


class ShareAccessLog(models.Model):
    class Outcome(models.TextChoices):
        GRANTED = "GRANTED"
        DENIED_EXPIRED = "DENIED_EXPIRED"
        DENIED_REVOKED = "DENIED_REVOKED"
        DENIED_SCOPE = "DENIED_SCOPE"

    share = models.ForeignKey(DataShare, on_delete=models.CASCADE, related_name="access_logs")
    accessed_at = models.DateTimeField(auto_now_add=True)
    outcome = models.CharField(max_length=16, choices=Outcome.choices)
    section = models.CharField(max_length=40)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-accessed_at"]
        indexes = [models.Index(fields=["share", "-accessed_at"], name="share_log_idx")]

    def __str__(self) -> str:
        return f"{self.share_id} {self.outcome} {self.section}"
