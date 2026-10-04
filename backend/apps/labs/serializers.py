from django.db import transaction
from rest_framework import serializers

from apps.profiles.api import ProfileRelatedField, ProfileScopedSerializer
from apps.records.models import CareProvider, MedicalDocument
from apps.records.serializers import ProviderSummarySerializer

from .models import LabReport, LabResult, normalize_test_key


class LabResultSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(read_only=True)
    range_position = serializers.CharField(read_only=True)

    class Meta:
        model = LabResult
        fields = [
            "id",
            "test_name",
            "test_key",
            "value",
            "value_text",
            "unit",
            "reference_low",
            "reference_high",
            "reference_text",
            "range_position",
            "source",
            "notes",
        ]
        read_only_fields = ["test_key", "source"]

    def validate(self, attrs):  # type: ignore[no-untyped-def]
        if attrs.get("value") is None and not attrs.get("value_text"):
            raise serializers.ValidationError({"value": ["Enter a numeric or text result."]})
        low, high = attrs.get("reference_low"), attrs.get("reference_high")
        if low is not None and high is not None and high < low:
            raise serializers.ValidationError(
                {"reference_high": ["The upper limit must be at least the lower limit."]}
            )
        return attrs


class LabReportSerializer(ProfileScopedSerializer):
    results = LabResultSerializer(many=True, required=False)
    ordered_by = ProfileRelatedField(CareProvider, required=False, allow_null=True)
    ordered_by_detail = ProviderSummarySerializer(source="ordered_by", read_only=True)
    document = ProfileRelatedField(MedicalDocument, required=False, allow_null=True)
    document_title = serializers.CharField(source="document.title", read_only=True, default=None)
    result_count = serializers.SerializerMethodField()

    class Meta:
        model = LabReport
        fields = [
            "id",
            "profile",
            "title",
            "lab_name",
            "report_date",
            "ordered_by",
            "ordered_by_detail",
            "document",
            "document_title",
            "notes",
            "results",
            "result_count",
            "created_at",
            "updated_at",
        ]

    def get_result_count(self, obj: LabReport) -> int:
        return len(obj.results.all())

    def validate_results(self, value: list[dict]) -> list[dict]:
        if len(value) > 200:
            raise serializers.ValidationError("A report can have at most 200 results.")
        return value

    def _write_results(self, report: LabReport, results: list[dict]) -> None:
        report.results.all().delete()
        LabResult.objects.bulk_create(
            [
                LabResult(report=report, test_key=normalize_test_key(item["test_name"]), **item)
                for item in results
            ]
        )

    @transaction.atomic
    def create(self, validated_data):  # type: ignore[no-untyped-def]
        results = validated_data.pop("results", [])
        report = super().create(validated_data)
        self._write_results(report, results)
        return report

    @transaction.atomic
    def update(self, instance, validated_data):  # type: ignore[no-untyped-def]
        results = validated_data.pop("results", None)
        report = super().update(instance, validated_data)
        if results is not None:
            self._write_results(report, results)
        return report


class TrendPointSerializer(serializers.Serializer):
    report_id = serializers.UUIDField(source="report.id")
    report_date = serializers.DateField(source="report.report_date")
    value = serializers.DecimalField(max_digits=12, decimal_places=4)
    unit = serializers.CharField()
    reference_low = serializers.DecimalField(max_digits=12, decimal_places=4, allow_null=True)
    reference_high = serializers.DecimalField(max_digits=12, decimal_places=4, allow_null=True)
    range_position = serializers.CharField(allow_null=True)


class TrendResponseSerializer(serializers.Serializer):
    test_key = serializers.CharField()
    points = TrendPointSerializer(many=True)
