from django.utils import timezone
from rest_framework import serializers

from apps.appointments.models import Appointment
from apps.profiles.api import ProfileRelatedField, ProfileScopedSerializer
from apps.records.models import CareProvider
from apps.records.serializers import ProviderSummarySerializer

from .models import TreatmentPlan, TreatmentTask


class TreatmentTaskSerializer(serializers.ModelSerializer):
    appointment = ProfileRelatedField(Appointment, required=False, allow_null=True)
    completed_by_name = serializers.CharField(
        source="completed_by.full_name", read_only=True, default=None
    )

    class Meta:
        model = TreatmentTask
        fields = [
            "id",
            "title",
            "kind",
            "due_date",
            "status",
            "completed_at",
            "completed_by_name",
            "appointment",
            "position",
            "notes",
            "created_at",
        ]
        read_only_fields = ["completed_at", "completed_by_name"]

    def update(self, instance, validated_data):  # type: ignore[no-untyped-def]
        new_status = validated_data.get("status")
        if new_status and new_status != instance.status:
            if new_status == TreatmentTask.Status.DONE:
                validated_data["completed_at"] = timezone.now()
                validated_data["completed_by"] = self.context["request"].user
            else:
                validated_data["completed_at"] = None
                validated_data["completed_by"] = None
        return super().update(instance, validated_data)


class TreatmentPlanSerializer(ProfileScopedSerializer):
    provider = ProfileRelatedField(CareProvider, required=False, allow_null=True)
    provider_detail = ProviderSummarySerializer(source="provider", read_only=True)
    tasks = TreatmentTaskSerializer(many=True, read_only=True)
    progress = serializers.SerializerMethodField()

    class Meta:
        model = TreatmentPlan
        fields = [
            "id",
            "profile",
            "title",
            "description",
            "provider",
            "provider_detail",
            "status",
            "start_date",
            "next_review_date",
            "tasks",
            "progress",
            "created_at",
            "updated_at",
        ]

    def get_progress(self, obj: TreatmentPlan) -> dict:
        tasks = list(obj.tasks.all())
        relevant = [t for t in tasks if t.status != TreatmentTask.Status.SKIPPED]
        done = sum(t.status == TreatmentTask.Status.DONE for t in relevant)
        return {
            "total": len(relevant),
            "done": done,
            "percent": round(done / len(relevant) * 100) if relevant else 0,
        }

    def validate(self, attrs):  # type: ignore[no-untyped-def]
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        review = attrs.get("next_review_date", getattr(self.instance, "next_review_date", None))
        if start and review and review < start:
            raise serializers.ValidationError(
                {"next_review_date": ["Review date can't be before the plan starts."]}
            )
        return attrs
