"""Medication tracking. HealthOS records what the user was prescribed; it never
recommends medications, doses or changes."""

from datetime import date

from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import F, Q

from apps.common.models import UUIDModel
from apps.profiles.models import ProfileOwnedModel
from apps.records.models import CareProvider, MedicalRecord


class Medication(ProfileOwnedModel):
    class Form(models.TextChoices):
        TABLET = "TABLET", "Tablet"
        CAPSULE = "CAPSULE", "Capsule"
        LIQUID = "LIQUID", "Liquid"
        INJECTION = "INJECTION", "Injection"
        INHALER = "INHALER", "Inhaler"
        TOPICAL = "TOPICAL", "Topical"
        DROPS = "DROPS", "Drops"
        OTHER = "OTHER", "Other"

    class Frequency(models.TextChoices):
        ONCE_DAILY = "ONCE_DAILY", "Once daily"
        TWICE_DAILY = "TWICE_DAILY", "Twice daily"
        THREE_TIMES_DAILY = "THREE_TIMES_DAILY", "Three times daily"
        FOUR_TIMES_DAILY = "FOUR_TIMES_DAILY", "Four times daily"
        WEEKLY = "WEEKLY", "Weekly"
        AS_NEEDED = "AS_NEEDED", "As needed"
        CUSTOM = "CUSTOM", "Custom schedule"

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        PAUSED = "PAUSED", "Paused"
        COMPLETED = "COMPLETED", "Completed"
        STOPPED = "STOPPED", "Stopped"

    name = models.CharField(max_length=150)
    dosage = models.CharField(max_length=60, help_text="As prescribed, e.g. '500 mg'.")
    form = models.CharField(max_length=10, choices=Form.choices, default=Form.TABLET)
    frequency = models.CharField(
        max_length=20, choices=Frequency.choices, default=Frequency.ONCE_DAILY
    )
    instructions = models.CharField(max_length=255, blank=True)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    paused_at = models.DateTimeField(null=True, blank=True)
    reminders_enabled = models.BooleanField(default=True)
    prescribed_by = models.ForeignKey(
        CareProvider, null=True, blank=True, on_delete=models.SET_NULL, related_name="medications"
    )
    source_record = models.ForeignKey(
        MedicalRecord, null=True, blank=True, on_delete=models.SET_NULL, related_name="medications"
    )
    notes = models.TextField(blank=True, max_length=2000)

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["profile", "status"], name="meds_profile_status_idx"),
            models.Index(fields=["profile", "-start_date"], name="meds_profile_start_idx"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(end_date__isnull=True) | Q(end_date__gte=F("start_date")),
                name="meds_end_after_start",
            )
        ]

    def __str__(self) -> str:
        return f"{self.name} {self.dosage}"

    def is_scheduled_on(self, day: date) -> bool:
        return (
            self.status == self.Status.ACTIVE
            and self.frequency != self.Frequency.AS_NEEDED
            and self.start_date <= day
            and (self.end_date is None or day <= self.end_date)
        )


class MedicationSchedule(UUIDModel):
    medication = models.ForeignKey(Medication, on_delete=models.CASCADE, related_name="schedules")
    time_of_day = models.TimeField()
    # ISO weekdays as 0=Monday … 6=Sunday. Empty means every day.
    days_of_week = ArrayField(
        models.PositiveSmallIntegerField(validators=[MinValueValidator(0), MaxValueValidator(6)]),
        default=list,
        blank=True,
    )

    class Meta:
        ordering = ["time_of_day"]
        constraints = [
            models.UniqueConstraint(
                fields=["medication", "time_of_day"], name="meds_schedule_unique_time"
            ),
        ]

    def applies_on(self, day: date) -> bool:
        return not self.days_of_week or day.weekday() in self.days_of_week


class MedicationLog(UUIDModel):
    class Status(models.TextChoices):
        TAKEN = "TAKEN", "Taken"
        SKIPPED = "SKIPPED", "Skipped"
        MISSED = "MISSED", "Missed"

    medication = models.ForeignKey(Medication, on_delete=models.CASCADE, related_name="logs")
    schedule = models.ForeignKey(
        MedicationSchedule, null=True, blank=True, on_delete=models.SET_NULL, related_name="logs"
    )
    scheduled_for = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=8, choices=Status.choices)
    taken_at = models.DateTimeField(null=True, blank=True)
    note = models.CharField(max_length=255, blank=True)
    logged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        ordering = ["-scheduled_for", "-created_at"]
        indexes = [
            models.Index(fields=["medication", "-scheduled_for"], name="meds_log_lookup_idx"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["schedule", "scheduled_for"],
                condition=Q(schedule__isnull=False),
                name="meds_log_one_per_dose",
            ),
        ]
