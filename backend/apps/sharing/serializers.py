from rest_framework import serializers

from apps.profiles.models import PatientProfile

from .models import DataShare, ShareAccessLog, ShareScope


class DataShareSerializer(serializers.ModelSerializer):
    profile_name = serializers.CharField(source="profile.full_name", read_only=True)
    state = serializers.CharField(read_only=True)
    revoked_by_name = serializers.CharField(
        source="revoked_by.full_name", read_only=True, default=None
    )

    class Meta:
        model = DataShare
        fields = [
            "id",
            "profile",
            "profile_name",
            "recipient_name",
            "recipient_email",
            "purpose",
            "scopes",
            "expires_at",
            "revoked_at",
            "revoked_by_name",
            "state",
            "access_count",
            "last_accessed_at",
            "created_at",
        ]
        read_only_fields = fields


class CreatedShareSerializer(DataShareSerializer):
    """Returned once at creation. The raw token is never retrievable again."""

    access_token = serializers.CharField()
    share_url = serializers.CharField()

    class Meta(DataShareSerializer.Meta):
        fields = [*DataShareSerializer.Meta.fields, "access_token", "share_url"]
        read_only_fields = fields


class CreateShareSerializer(serializers.Serializer):
    profile = serializers.UUIDField(required=False)
    recipient_name = serializers.CharField(max_length=150)
    recipient_email = serializers.EmailField(required=False, allow_blank=True, default="")
    purpose = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    scopes = serializers.MultipleChoiceField(choices=ShareScope.choices, allow_empty=False)
    duration_hours = serializers.IntegerField(min_value=1, max_value=24 * 30)
    send_email = serializers.BooleanField(default=False)

    def validate(self, attrs):  # type: ignore[no-untyped-def]
        if attrs["send_email"] and not attrs["recipient_email"]:
            raise serializers.ValidationError(
                {"recipient_email": ["Enter the recipient's email to send them the link."]}
            )
        return attrs


class ShareAccessLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShareAccessLog
        fields = ["id", "accessed_at", "outcome", "section", "ip_address", "user_agent"]


class SharedProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientProfile
        fields = ["full_name", "date_of_birth", "sex", "blood_type", "height_cm"]


class ShareSummarySerializer(serializers.Serializer):
    patient_name = serializers.CharField(source="profile.full_name")
    shared_by = serializers.CharField(source="created_by.full_name")
    recipient_name = serializers.CharField()
    purpose = serializers.CharField()
    scopes = serializers.ListField(child=serializers.CharField())
    expires_at = serializers.DateTimeField()
