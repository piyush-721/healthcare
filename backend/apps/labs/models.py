"""Lab reports and results entered by the user.

Results are compared only against the reference range printed on the user's own
report. HealthOS never interprets results clinically.
"""

import re

from django.db import models
from django.db.models import F, Q

from apps.common.models import UUIDModel
from apps.profiles.models import ProfileOwnedModel
from apps.records.models import CareProvider, MedicalDocument


def normalize_test_key(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.strip().lower()).strip("-")[:100]


class LabReport(ProfileOwnedModel):
    title = models.CharField(max_length=200)
    lab_name = models.CharField(max_length=150, blank=True)
    report_date = models.DateField()
    ordered_by = models.ForeignKey(
        CareProvider, null=True, blank=True, on_delete=models.SET_NULL, related_name="lab_reports"
    )
    document = models.ForeignKey(
        MedicalDocument,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="lab_reports",
    )
    notes = models.TextField(blank=True, max_length=2000)

    class Meta:
        ordering = ["-report_date", "-created_at"]
        indexes = [models.Index(fields=["profile", "-report_date"], name="labs_report_date_idx")]


class LabResult(UUIDModel):
    class Source(models.TextChoices):
        MANUAL = "MANUAL", "Entered manually"
        MACHINE_EXTRACTED = "MACHINE_EXTRACTED", "Machine-extracted (needs review)"

    report = models.ForeignKey(LabReport, on_delete=models.CASCADE, related_name="results")
    test_name = models.CharField(max_length=120)
    test_key = models.CharField(max_length=100, db_index=True)
    value = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    value_text = models.CharField(
        max_length=120, blank=True, help_text="Qualitative results such as 'Negative'."
    )
    unit = models.CharField(max_length=30, blank=True)
    reference_low = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    reference_high = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    reference_text = models.CharField(max_length=120, blank=True)
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.MANUAL)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["test_name"]
        constraints = [
            models.CheckConstraint(
                condition=Q(value__isnull=False) | ~Q(value_text=""),
                name="labs_result_has_value",
            ),
            models.CheckConstraint(
                condition=Q(reference_low__isnull=True)
                | Q(reference_high__isnull=True)
                | Q(reference_high__gte=F("reference_low")),
                name="labs_reference_range_ordered",
            ),
        ]

    def save(self, *args, **kwargs):  # type: ignore[no-untyped-def]
        self.test_key = normalize_test_key(self.test_name)
        super().save(*args, **kwargs)

    @property
    def range_position(self) -> str | None:
        """Where the value sits relative to the report's own reference range."""
        if self.value is None or (self.reference_low is None and self.reference_high is None):
            return None
        if self.reference_low is not None and self.value < self.reference_low:
            return "BELOW"
        if self.reference_high is not None and self.value > self.reference_high:
            return "ABOVE"
        return "WITHIN"
