from rest_framework import serializers

from .models import MANDATORY_IN_APP, Notification, NotificationCategory


class NotificationSerializer(serializers.ModelSerializer):
    is_read = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = ["id", "category", "title", "body", "link", "is_read", "read_at", "created_at"]
        read_only_fields = fields

    def get_is_read(self, obj: Notification) -> bool:
        return obj.read_at is not None


class NotificationPreferenceSerializer(serializers.Serializer):
    category = serializers.ChoiceField(choices=NotificationCategory.choices)
    label = serializers.CharField(read_only=True)
    email_enabled = serializers.BooleanField()
    in_app_enabled = serializers.BooleanField()
    in_app_locked = serializers.BooleanField(read_only=True)

    def validate(self, attrs):  # type: ignore[no-untyped-def]
        if attrs["category"] in MANDATORY_IN_APP and not attrs["in_app_enabled"]:
            raise serializers.ValidationError(
                {"in_app_enabled": ["Security notices are always shown in the app."]}
            )
        return attrs
