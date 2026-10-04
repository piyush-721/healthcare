"""Medical records, uploaded documents and the care providers they reference."""

from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.profiles.models import ProfileOwnedModel


class CareProvider(ProfileOwnedModel):
    """A doctor, clinic, hospital or lab in this profile's care network."""

    class Kind(models.TextChoices):
        DOCTOR = "DOCTOR", "Doctor"
        CLINIC = "CLINIC", "Clinic"
        HOSPITAL = "HOSPITAL", "Hospital"
        LAB = "LAB", "Laboratory"
        PHARMACY = "PHARMACY", "Pharmacy"
        OTHER = "OTHER", "Other"

    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.DOCTOR)
    name = models.CharField(max_length=150)
    specialty = models.CharField(max_length=100, blank=True)
    organization = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    email = models.EmailField(blank=True)
    address = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True, max_length=2000)

    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=["profile", "name"], name="records_provider_idx")]


class MedicalRecord(ProfileOwnedModel):
    """A clinical encounter or record the user wants to keep (consultation, discharge…)."""

    class RecordType(models.TextChoices):
        CONSULTATION = "CONSULTATION", "Consultation"
        PRESCRIPTION = "PRESCRIPTION", "Prescription"
        LAB_REPORT = "LAB_REPORT", "Lab report"
        DISCHARGE_SUMMARY = "DISCHARGE_SUMMARY", "Discharge summary"
        IMAGING = "IMAGING", "Imaging / scan"
        VACCINATION = "VACCINATION", "Vaccination"
        PROCEDURE = "PROCEDURE", "Procedure"
        OTHER = "OTHER", "Other"

    title = models.CharField(max_length=200)
    record_type = models.CharField(max_length=20, choices=RecordType.choices)
    record_date = models.DateField()
    provider = models.ForeignKey(
        CareProvider, null=True, blank=True, on_delete=models.SET_NULL, related_name="records"
    )
    description = models.TextField(blank=True, max_length=5000)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        ordering = ["-record_date", "-created_at"]
        indexes = [
            models.Index(fields=["profile", "-record_date"], name="records_record_date_idx"),
            models.Index(fields=["profile", "record_type"], name="records_record_type_idx"),
        ]


class MedicalDocument(ProfileOwnedModel):
    """Metadata for an uploaded file. The file itself lives in private storage."""

    class DocumentType(models.TextChoices):
        PRESCRIPTION = "PRESCRIPTION", "Prescription"
        LAB_REPORT = "LAB_REPORT", "Lab report"
        DISCHARGE_SUMMARY = "DISCHARGE_SUMMARY", "Discharge summary"
        MEDICAL_BILL = "MEDICAL_BILL", "Medical bill"
        VACCINATION = "VACCINATION", "Vaccination record"
        SCAN_REPORT = "SCAN_REPORT", "Scan report"
        OTHER = "OTHER", "Other"

    class ScanStatus(models.TextChoices):
        PENDING = "PENDING", "Scanning"
        CLEAN = "CLEAN", "Clean"
        INFECTED = "INFECTED", "Blocked — threat detected"
        FAILED = "FAILED", "Scan failed"

    record = models.ForeignKey(
        MedicalRecord, null=True, blank=True, on_delete=models.SET_NULL, related_name="documents"
    )
    title = models.CharField(max_length=200)
    document_type = models.CharField(max_length=20, choices=DocumentType.choices)
    document_date = models.DateField(null=True, blank=True)
    storage_key = models.CharField(max_length=255, unique=True)
    original_filename = models.CharField(max_length=150)
    content_type = models.CharField(max_length=50)
    size_bytes = models.PositiveIntegerField()
    sha256 = models.CharField(max_length=64)
    scan_status = models.CharField(
        max_length=10, choices=ScanStatus.choices, default=ScanStatus.PENDING
    )
    scan_detail = models.CharField(max_length=120, blank=True)
    scanned_at = models.DateTimeField(null=True, blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+"
    )
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["profile", "-created_at"],
                name="records_doc_profile_idx",
                condition=Q(archived_at__isnull=True),
            ),
            models.Index(fields=["profile", "document_type"], name="records_doc_type_idx"),
        ]
        constraints = [
            models.CheckConstraint(condition=Q(size_bytes__gt=0), name="records_doc_size_gt_0"),
        ]

    @property
    def is_available(self) -> bool:
        return self.scan_status == self.ScanStatus.CLEAN
