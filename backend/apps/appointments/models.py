from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q

from apps.common.models import UUIDModel
from apps.profiles.models import ProfileOwnedModel
from apps.records.models import CareProvider


class Appointment(ProfileOwnedModel):
    class Status(models.TextChoices):
        SCHEDULED = "SCHEDULED", "Upcoming"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"
        MISSED = "MISSED", "Missed"

    class Kind(models.TextChoices):
        IN_PERSON = "IN_PERSON", "In person"
        VIDEO = "VIDEO", "Video"
        PHONE = "PHONE", "Phone"

    title = models.CharField(max_length=200)
    provider = models.ForeignKey(
        CareProvider, null=True, blank=True, on_delete=models.SET_NULL, related_name="appointments"
    )
    provider_name = models.CharField(
        max_length=150, blank=True, help_text="Free text when no saved provider is linked."
    )
    location = models.CharField(max_length=255, blank=True)
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.IN_PERSON)
    scheduled_at = models.DateTimeField()
    duration_minutes = models.PositiveSmallIntegerField(
        default=30, validators=[MinValueValidator(5), MaxValueValidator(24 * 60)]
    )
    reason = models.CharField(max_length=500, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.SCHEDULED)
    cancellation_reason = models.CharField(max_length=255, blank=True)
    follow_up_date = models.DateField(null=True, blank=True)
    reminder_minutes_before = models.PositiveIntegerField(
        null=True,
        blank=True,
        default=24 * 60,
        validators=[MinValueValidator(5), MaxValueValidator(7 * 24 * 60)],
    )
    reminder_sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["scheduled_at"]
        indexes = [
            models.Index(
                fields=["profile", "status", "scheduled_at"], name="appt_profile_status_idx"
            ),
            models.Index(
                fields=["scheduled_at"],
                name="appt_reminder_due_idx",
                condition=Q(status="SCHEDULED", reminder_sent_at__isnull=True),
            ),
        ]


class AppointmentNote(UUIDModel):
    appointment = models.ForeignKey(Appointment, on_delete=models.CASCADE, related_name="notes")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+"
    )
    body = models.TextField(max_length=5000)

    class Meta:
        ordering = ["created_at"]
