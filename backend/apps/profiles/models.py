"""Health profiles and the patient-reported health information attached to them.

A ``PatientProfile`` is the subject of all health data. Every account has one
"self" profile; an account may also own dependent profiles (e.g. a child or an
elderly parent without their own account), acting as their guardian.
"""

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q

from apps.common.models import UUIDModel


class Relationship(models.TextChoices):
    SELF = "SELF", "Self"
    CHILD = "CHILD", "Child"
    PARENT = "PARENT", "Parent"
    SPOUSE = "SPOUSE", "Spouse / partner"
    SIBLING = "SIBLING", "Sibling"
    GRANDPARENT = "GRANDPARENT", "Grandparent"
    OTHER = "OTHER", "Other"


class PatientProfile(UUIDModel):
    class Sex(models.TextChoices):
        FEMALE = "FEMALE", "Female"
        MALE = "MALE", "Male"
        INTERSEX = "INTERSEX", "Intersex"
        UNDISCLOSED = "UNDISCLOSED", "Prefer not to say"

    class BloodType(models.TextChoices):
        A_POS = "A+"
        A_NEG = "A-"
        B_POS = "B+"
        B_NEG = "B-"
        AB_POS = "AB+"
        AB_NEG = "AB-"
        O_POS = "O+"
        O_NEG = "O-"
        UNKNOWN = "UNKNOWN", "Unknown"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="owned_profiles"
    )
    is_self = models.BooleanField(default=False)
    relationship_to_owner = models.CharField(
        max_length=12, choices=Relationship.choices, default=Relationship.SELF
    )
    full_name = models.CharField(max_length=150)
    date_of_birth = models.DateField(null=True, blank=True)
    sex = models.CharField(max_length=12, choices=Sex.choices, default=Sex.UNDISCLOSED)
    blood_type = models.CharField(
        max_length=8, choices=BloodType.choices, default=BloodType.UNKNOWN
    )
    height_cm = models.DecimalField(
        max_digits=5,
        decimal_places=1,
        null=True,
        blank=True,
        validators=[MinValueValidator(20), MaxValueValidator(300)],
    )
    phone = models.CharField(max_length=32, blank=True)
    address = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True, max_length=2000)

    class Meta:
        ordering = ["-is_self", "full_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["owner"], condition=Q(is_self=True), name="profiles_one_self_per_owner"
            ),
            models.CheckConstraint(
                condition=(
                    Q(is_self=True, relationship_to_owner="SELF")
                    | (Q(is_self=False) & ~Q(relationship_to_owner="SELF"))
                ),
                name="profiles_self_relationship_consistent",
            ),
        ]

    def __str__(self) -> str:
        return self.full_name


class ProfileOwnedModel(UUIDModel):
    """Base for every record that belongs to a single patient profile."""

    profile = models.ForeignKey(PatientProfile, on_delete=models.CASCADE, related_name="%(class)ss")

    class Meta:
        abstract = True


class EmergencyContact(ProfileOwnedModel):
    name = models.CharField(max_length=150)
    relationship = models.CharField(max_length=60, blank=True)
    phone = models.CharField(max_length=32)
    email = models.EmailField(blank=True)
    is_primary = models.BooleanField(default=False)

    class Meta:
        ordering = ["-is_primary", "name"]
        indexes = [models.Index(fields=["profile", "name"], name="profiles_ec_profile_idx")]


class Allergy(ProfileOwnedModel):
    class Severity(models.TextChoices):
        MILD = "MILD"
        MODERATE = "MODERATE"
        SEVERE = "SEVERE"
        UNKNOWN = "UNKNOWN"

    substance = models.CharField(max_length=150)
    reaction = models.CharField(max_length=255, blank=True)
    severity = models.CharField(max_length=10, choices=Severity.choices, default=Severity.UNKNOWN)
    noted_on = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True, max_length=2000)

    class Meta:
        ordering = ["substance"]
        indexes = [models.Index(fields=["profile", "substance"], name="profiles_allergy_idx")]


class MedicalCondition(ProfileOwnedModel):
    """A condition as recorded by the user from their provider — not inferred by HealthOS."""

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE"
        MANAGED = "MANAGED"
        RESOLVED = "RESOLVED"

    name = models.CharField(max_length=150)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    diagnosed_on = models.DateField(null=True, blank=True)
    resolved_on = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True, max_length=2000)

    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=["profile", "status"], name="profiles_condition_idx")]
        constraints = [
            models.CheckConstraint(
                condition=Q(resolved_on__isnull=True)
                | Q(diagnosed_on__isnull=True)
                | Q(resolved_on__gte=models.F("diagnosed_on")),
                name="profiles_condition_dates_ordered",
            )
        ]


class VitalRecord(ProfileOwnedModel):
    class VitalType(models.TextChoices):
        BLOOD_PRESSURE = "BLOOD_PRESSURE", "Blood pressure"
        HEART_RATE = "HEART_RATE", "Heart rate"
        WEIGHT = "WEIGHT", "Weight"
        TEMPERATURE = "TEMPERATURE", "Temperature"
        BLOOD_GLUCOSE = "BLOOD_GLUCOSE", "Blood glucose"
        OXYGEN_SATURATION = "OXYGEN_SATURATION", "Oxygen saturation"
        RESPIRATORY_RATE = "RESPIRATORY_RATE", "Respiratory rate"

    vital_type = models.CharField(max_length=20, choices=VitalType.choices)
    value = models.DecimalField(max_digits=7, decimal_places=2, validators=[MinValueValidator(0)])
    # Used for diastolic pressure when vital_type is BLOOD_PRESSURE.
    secondary_value = models.DecimalField(
        max_digits=7, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)]
    )
    unit = models.CharField(max_length=20)
    measured_at = models.DateTimeField()
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-measured_at"]
        indexes = [
            models.Index(
                fields=["profile", "vital_type", "-measured_at"], name="profiles_vital_lookup_idx"
            )
        ]
        constraints = [
            models.CheckConstraint(condition=Q(value__gte=0), name="profiles_vital_value_gte_0"),
        ]


class VaccinationRecord(ProfileOwnedModel):
    vaccine_name = models.CharField(max_length=150)
    dose_number = models.PositiveSmallIntegerField(null=True, blank=True)
    administered_on = models.DateField()
    administered_by = models.CharField(max_length=150, blank=True)
    lot_number = models.CharField(max_length=60, blank=True)
    next_dose_due = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True, max_length=2000)

    class Meta:
        ordering = ["-administered_on"]
        indexes = [
            models.Index(fields=["profile", "-administered_on"], name="profiles_vaccination_idx")
        ]
