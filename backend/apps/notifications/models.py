import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q


class NotificationCategory(models.TextChoices):
    APPOINTMENT_REMINDER = "APPOINTMENT_REMINDER", "Appointment reminders"
    MEDICATION_REMINDER = "MEDICATION_REMINDER", "Medication reminders"
    TREATMENT = "TREATMENT", "Treatment plan updates"
    SHARING = "SHARING", "Sharing & family access"
    SECURITY = "SECURITY", "Account & security"


# (email, in_app) defaults when the user has not saved a preference.
DEFAULT_PREFERENCES: dict[str, tuple[bool, bool]] = {
    NotificationCategory.APPOINTMENT_REMINDER: (True, True),
    NotificationCategory.MEDICATION_REMINDER: (False, True),
    NotificationCategory.TREATMENT: (False, True),
    NotificationCategory.SHARING: (True, True),
    NotificationCategory.SECURITY: (True, True),
}

# Security notices are always shown in-app; users may only opt out of the email copy.
MANDATORY_IN_APP = {NotificationCategory.SECURITY}


class Notification(models.Model):
    """A notification delivery record.

    A row is created for every notification (even if in-app display is disabled)
    so ``dedupe_key`` reliably prevents duplicate reminders across worker runs.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    category = models.CharField(max_length=24, choices=NotificationCategory.choices)
    title = models.CharField(max_length=150)
    body = models.CharField(max_length=500, blank=True)
    link = models.CharField(max_length=255, blank=True)
    show_in_app = models.BooleanField(default=True)
    read_at = models.DateTimeField(null=True, blank=True)
    emailed_at = models.DateTimeField(null=True, blank=True)
    dedupe_key = models.CharField(max_length=160, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "show_in_app", "-created_at"], name="notif_user_feed_idx"),
            models.Index(
                fields=["user"],
                condition=Q(read_at__isnull=True, show_in_app=True),
                name="notif_user_unread_idx",
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["dedupe_key"],
                condition=Q(dedupe_key__isnull=False),
                name="notif_dedupe_key_unique",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.category}: {self.title}"


class NotificationPreference(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notification_preferences"
    )
    category = models.CharField(max_length=24, choices=NotificationCategory.choices)
    email_enabled = models.BooleanField(default=True)
    in_app_enabled = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "category"], name="notif_pref_unique"),
        ]

    def __str__(self) -> str:
        return f"{self.user_id}:{self.category}"
