from rest_framework import serializers

from .access import resolve_access
from .api import ProfileScopedSerializer
from .models import (
    Allergy,
    EmergencyContact,
    MedicalCondition,
    PatientProfile,
    Relationship,
    VaccinationRecord,
    VitalRecord,
)


class PatientProfileSerializer(serializers.ModelSerializer):
    access_role = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()
    owner_name = serializers.CharField(source="owner.full_name", read_only=True)

    class Meta:
        model = PatientProfile
        fields = [
            "id",
            "is_self",
            "relationship_to_owner",
            "full_name",
            "date_of_birth",
            "sex",
            "blood_type",
            "height_cm",
            "phone",
            "address",
            "city",
            "country",
            "notes",
            "owner_name",
            "access_role",
            "permissions",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "is_self", "created_at", "updated_at"]

    def _access(self, obj: PatientProfile):  # type: ignore[no-untyped-def]
        cache = self.context.setdefault("_access_cache", {})
        if obj.id not in cache:
            cache[obj.id] = resolve_access(self.context["request"].user, obj)
        return cache[obj.id]

    def get_access_role(self, obj: PatientProfile) -> str | None:
        access = self._access(obj)
        return access.role if access else None

    def get_permissions(self, obj: PatientProfile) -> list[str]:
        access = self._access(obj)
        return sorted(access.permissions) if access else []

    def validate_relationship_to_owner(self, value: str) -> str:
        instance = self.instance
        is_self = instance.is_self if instance is not None else False
        if is_self and value != Relationship.SELF:
            raise serializers.ValidationError("Your own profile's relationship is always Self.")
        if not is_self and value == Relationship.SELF:
            raise serializers.ValidationError("Choose how this person is related to you.")
        return value


class DependentProfileCreateSerializer(PatientProfileSerializer):
    relationship_to_owner = serializers.ChoiceField(
        choices=[c for c in Relationship.choices if c[0] != Relationship.SELF]
    )


class EmergencyContactSerializer(ProfileScopedSerializer):
    class Meta:
        model = EmergencyContact
        fields = [
            "id",
            "profile",
            "name",
            "relationship",
            "phone",
            "email",
            "is_primary",
            "created_at",
            "updated_at",
        ]


class AllergySerializer(ProfileScopedSerializer):
    class Meta:
        model = Allergy
        fields = [
            "id",
            "profile",
            "substance",
            "reaction",
            "severity",
            "noted_on",
            "notes",
            "created_at",
            "updated_at",
        ]


class MedicalConditionSerializer(ProfileScopedSerializer):
    class Meta:
        model = MedicalCondition
        fields = [
            "id",
            "profile",
            "name",
            "status",
            "diagnosed_on",
            "resolved_on",
            "notes",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):  # type: ignore[no-untyped-def]
        diagnosed = attrs.get("diagnosed_on", getattr(self.instance, "diagnosed_on", None))
        resolved = attrs.get("resolved_on", getattr(self.instance, "resolved_on", None))
        if diagnosed and resolved and resolved < diagnosed:
            raise serializers.ValidationError(
                {"resolved_on": ["Resolved date cannot be before the diagnosed date."]}
            )
        return attrs


class VitalRecordSerializer(ProfileScopedSerializer):
    class Meta:
        model = VitalRecord
        fields = [
            "id",
            "profile",
            "vital_type",
            "value",
            "secondary_value",
            "unit",
            "measured_at",
            "notes",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):  # type: ignore[no-untyped-def]
        vital_type = attrs.get("vital_type", getattr(self.instance, "vital_type", None))
        secondary = attrs.get("secondary_value", getattr(self.instance, "secondary_value", None))
        if vital_type == VitalRecord.VitalType.BLOOD_PRESSURE and secondary is None:
            raise serializers.ValidationError(
                {"secondary_value": ["Enter the diastolic value for blood pressure."]}
            )
        return attrs


class VaccinationRecordSerializer(ProfileScopedSerializer):
    class Meta:
        model = VaccinationRecord
        fields = [
            "id",
            "profile",
            "vaccine_name",
            "dose_number",
            "administered_on",
            "administered_by",
            "lot_number",
            "next_dose_due",
            "notes",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):  # type: ignore[no-untyped-def]
        given = attrs.get("administered_on", getattr(self.instance, "administered_on", None))
        due = attrs.get("next_dose_due", getattr(self.instance, "next_dose_due", None))
        if given and due and due < given:
            raise serializers.ValidationError(
                {"next_dose_due": ["Next dose date cannot be before the administered date."]}
            )
        return attrs
