from django.db import transaction
from rest_framework import serializers

from apps.profiles.api import ProfileRelatedField, ProfileScopedSerializer
from apps.records.models import CareProvider, MedicalRecord
from apps.records.serializers import ProviderSummarySerializer

from .models import Medication, MedicationLog, MedicationSchedule


class MedicationScheduleSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(read_only=True)
    days_of_week = serializers.ListField(
        child=serializers.IntegerField(min_value=0, max_value=6), required=False, max_length=7
    )

    class Meta:
        model = MedicationSchedule
        fields = ["id", "time_of_day", "days_of_week"]


class MedicationSerializer(ProfileScopedSerializer):
    schedules = MedicationScheduleSerializer(many=True, required=False)
    prescribed_by = ProfileRelatedField(CareProvider, required=False, allow_null=True)
    prescribed_by_detail = ProviderSummarySerializer(source="prescribed_by", read_only=True)
    source_record = ProfileRelatedField(MedicalRecord, required=False, allow_null=True)

    class Meta:
        model = Medication
        fields = [
            "id",
            "profile",
            "name",
            "dosage",
            "form",
            "frequency",
            "instructions",
            "start_date",
            "end_date",
            "status",
            "paused_at",
            "reminders_enabled",
            "prescribed_by",
            "prescribed_by_detail",
            "source_record",
            "notes",
            "schedules",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["status", "paused_at"]

    def validate_schedules(self, value: list[dict]) -> list[dict]:
        times = [item["time_of_day"] for item in value]
        if len(times) != len(set(times)):
            raise serializers.ValidationError("Each reminder time must be different.")
        if len(value) > 12:
            raise serializers.ValidationError("A medication can have at most 12 daily times.")
        return value

    def validate(self, attrs):  # type: ignore[no-untyped-def]
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start and end and end < start:
            raise serializers.ValidationError(
                {"end_date": ["End date cannot be before the start date."]}
            )
        return attrs

    def _write_schedules(self, medication: Medication, schedules: list[dict]) -> None:
        medication.schedules.all().delete()
        MedicationSchedule.objects.bulk_create(
            [
                MedicationSchedule(
                    medication=medication,
                    time_of_day=item["time_of_day"],
                    days_of_week=sorted(set(item.get("days_of_week", []))),
                )
                for item in schedules
            ]
        )

    @transaction.atomic
    def create(self, validated_data):  # type: ignore[no-untyped-def]
        schedules = validated_data.pop("schedules", [])
        medication = super().create(validated_data)
        self._write_schedules(medication, schedules)
        return medication

    @transaction.atomic
    def update(self, instance, validated_data):  # type: ignore[no-untyped-def]
        schedules = validated_data.pop("schedules", None)
        medication = super().update(instance, validated_data)
        if schedules is not None:
            self._write_schedules(medication, schedules)
        return medication


class MedicationLogSerializer(serializers.ModelSerializer):
    logged_by_name = serializers.CharField(
        source="logged_by.full_name", read_only=True, default=None
    )

    class Meta:
        model = MedicationLog
        fields = [
            "id",
            "medication",
            "schedule",
            "scheduled_for",
            "status",
            "taken_at",
            "note",
            "logged_by_name",
            "created_at",
        ]
        read_only_fields = fields


class LogDoseSerializer(serializers.Serializer):
    schedule = serializers.UUIDField(required=False, allow_null=True)
    scheduled_for = serializers.DateTimeField(required=False, allow_null=True)
    status = serializers.ChoiceField(choices=MedicationLog.Status.choices)
    taken_at = serializers.DateTimeField(required=False, allow_null=True)
    note = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")

    def validate(self, attrs):  # type: ignore[no-untyped-def]
        if bool(attrs.get("schedule")) != bool(attrs.get("scheduled_for")):
            raise serializers.ValidationError(
                "Provide both schedule and scheduled_for for a scheduled dose, or neither."
            )
        return attrs


class TodayDoseSerializer(serializers.Serializer):
    medication_id = serializers.UUIDField(source="medication.id")
    medication_name = serializers.CharField(source="medication.name")
    dosage = serializers.CharField(source="medication.dosage")
    instructions = serializers.CharField(source="medication.instructions")
    schedule_id = serializers.UUIDField(source="schedule.id")
    scheduled_for = serializers.DateTimeField()
    status = serializers.CharField()
    log_id = serializers.UUIDField(source="log.id", default=None)


class TodayDosesResponseSerializer(serializers.Serializer):
    date = serializers.DateField()
    timezone = serializers.CharField()
    doses = TodayDoseSerializer(many=True)
