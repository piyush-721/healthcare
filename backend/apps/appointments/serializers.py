from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from apps.profiles.api import ProfileRelatedField, ProfileScopedSerializer
from apps.records.models import CareProvider
from apps.records.serializers import ProviderSummarySerializer

from .models import Appointment, AppointmentNote


class AppointmentNoteSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.full_name", read_only=True, default=None)

    class Meta:
        model = AppointmentNote
        fields = ["id", "body", "author_name", "created_at"]
        read_only_fields = ["id", "author_name", "created_at"]


class AppointmentSerializer(ProfileScopedSerializer):
    provider = ProfileRelatedField(CareProvider, required=False, allow_null=True)
    provider_detail = ProviderSummarySerializer(source="provider", read_only=True)
    notes = AppointmentNoteSerializer(many=True, read_only=True)
    needs_update = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = [
            "id",
            "profile",
            "title",
            "provider",
            "provider_detail",
            "provider_name",
            "location",
            "kind",
            "scheduled_at",
            "duration_minutes",
            "reason",
            "status",
            "cancellation_reason",
            "follow_up_date",
            "reminder_minutes_before",
            "needs_update",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["status", "cancellation_reason"]

    def get_needs_update(self, obj: Appointment) -> bool:
        """A past appointment still marked upcoming — the user should record what happened."""
        return obj.status == Appointment.Status.SCHEDULED and obj.scheduled_at < timezone.now()

    def validate_scheduled_at(self, value):  # type: ignore[no-untyped-def]
        if self.instance is None and value < timezone.now() - timedelta(days=365 * 5):
            raise serializers.ValidationError("That date is too far in the past.")
        return value

    def validate(self, attrs):  # type: ignore[no-untyped-def]
        scheduled = attrs.get("scheduled_at", getattr(self.instance, "scheduled_at", None))
        follow_up = attrs.get("follow_up_date", getattr(self.instance, "follow_up_date", None))
        if scheduled and follow_up and follow_up < scheduled.date():
            raise serializers.ValidationError(
                {"follow_up_date": ["Follow-up date must be on or after the appointment."]}
            )
        if "scheduled_at" in attrs or "reminder_minutes_before" in attrs:
            attrs["reminder_sent_at"] = None
        return attrs


class StatusChangeSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[
            Appointment.Status.COMPLETED,
            Appointment.Status.CANCELLED,
            Appointment.Status.MISSED,
            Appointment.Status.SCHEDULED,
        ]
    )
    cancellation_reason = serializers.CharField(max_length=255, required=False, allow_blank=True)
