"""Caregiver access grants.

Dependent family members (e.g. a child) are represented as ``PatientProfile``
rows owned by their guardian. Other adults who help manage someone's health
(e.g. an adult child helping a parent) get an explicit, permission-scoped
``CaregiverAccess`` grant to the profile — never blanket access.
"""

from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.db import models
from django.db.models import Q

from apps.common.models import UUIDModel
from apps.profiles.access import Perm
from apps.profiles.models import PatientProfile


class CaregiverAccess(UUIDModel):
    class Status(models.TextChoices):
        PENDING = "PENDING"
        ACTIVE = "ACTIVE"
        DECLINED = "DECLINED"
        REVOKED = "REVOKED"

    profile = models.ForeignKey(
        PatientProfile, on_delete=models.CASCADE, related_name="caregiver_grants"
    )
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="caregiver_grants_given"
    )
    caregiver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="caregiver_grants",
    )
    invite_email = models.EmailField()
    relationship = models.CharField(max_length=60, blank=True)
    permissions = ArrayField(models.CharField(max_length=32, choices=Perm.choices), default=list)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    invite_expires_at = models.DateTimeField()
    # Optional end date for the access itself.
    expires_at = models.DateTimeField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["caregiver", "status"], name="family_grant_caregiver_idx"),
            models.Index(fields=["profile", "status"], name="family_grant_profile_idx"),
            models.Index(fields=["invite_email", "status"], name="family_grant_invite_idx"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["profile", "caregiver"],
                condition=Q(status="ACTIVE"),
                name="family_one_active_grant_per_caregiver",
            ),
            models.UniqueConstraint(
                fields=["profile", "invite_email"],
                condition=Q(status="PENDING"),
                name="family_one_pending_invite_per_email",
            ),
            models.CheckConstraint(
                condition=~Q(status="ACTIVE") | Q(caregiver__isnull=False),
                name="family_active_grant_has_caregiver",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.invite_email} → {self.profile_id} ({self.status})"
