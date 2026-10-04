from rest_framework import serializers

from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = [
            "id",
            "created_at",
            "event_type",
            "target_type",
            "target_id",
            "ip_address",
            "user_agent",
            "metadata",
        ]


class AdminAuditLogSerializer(serializers.ModelSerializer):
    actor_email = serializers.EmailField(source="actor.email", read_only=True, default=None)
    subject_email = serializers.EmailField(
        source="subject_user.email", read_only=True, default=None
    )

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "created_at",
            "event_type",
            "actor",
            "actor_email",
            "subject_user",
            "subject_email",
            "profile_id",
            "target_type",
            "target_id",
            "ip_address",
            "user_agent",
            "request_id",
            "metadata",
        ]
