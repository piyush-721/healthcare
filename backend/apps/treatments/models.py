"""Treatment plans are organizational checklists the user builds from their
provider's instructions — HealthOS never generates or prescribes treatment."""

from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.appointments.models import Appointment
from apps.common.models import UUIDModel
from apps.profiles.models import ProfileOwnedModel
from apps.records.models import CareProvider


class TreatmentPlan(ProfileOwnedModel):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        COMPLETED = "COMPLETED", "Completed"
        ARCHIVED = "ARCHIVED", "Archived"

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, max_length=5000)
    provider = models.ForeignKey(
        CareProvider,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="treatment_plans",
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    start_date = models.DateField()
    next_review_date = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ["status", "-start_date"]
        indexes = [models.Index(fields=["profile", "status"], name="treat_plan_status_idx")]


class TreatmentTask(UUIDModel):
    class Kind(models.TextChoices):
        TASK = "TASK", "Task"
        TEST = "TEST", "Test"
        FOLLOW_UP = "FOLLOW_UP", "Follow-up"
        UPLOAD = "UPLOAD", "Upload document"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        DONE = "DONE", "Done"
        SKIPPED = "SKIPPED", "Skipped"

    plan = models.ForeignKey(TreatmentPlan, on_delete=models.CASCADE, related_name="tasks")
    title = models.CharField(max_length=200)
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.TASK)
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=8, choices=Status.choices, default=Status.PENDING)
    completed_at = models.DateTimeField(null=True, blank=True)
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    appointment = models.ForeignKey(
        Appointment,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="treatment_tasks",
    )
    position = models.PositiveIntegerField(default=0)
    notes = models.CharField(max_length=500, blank=True)

    class Meta:
        ordering = ["position", "due_date", "created_at"]
        indexes = [
            models.Index(fields=["plan", "status"], name="treat_task_status_idx"),
            models.Index(
                fields=["due_date"], name="treat_task_due_idx", condition=Q(status="PENDING")
            ),
        ]
