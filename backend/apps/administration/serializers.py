from rest_framework import serializers

from apps.accounts.models import User


class AdminUserSerializer(serializers.ModelSerializer):
    email_verified = serializers.BooleanField(source="is_email_verified", read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "full_name",
            "role",
            "status",
            "email_verified",
            "date_joined",
            "last_login",
            "status_changed_at",
            "timezone",
        ]
        read_only_fields = fields


class AdminUserDetailSerializer(AdminUserSerializer):
    active_sessions = serializers.IntegerField(read_only=True)

    class Meta(AdminUserSerializer.Meta):
        fields = [*AdminUserSerializer.Meta.fields, "active_sessions"]
        read_only_fields = fields


class SuspendSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=255)


class RoleSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=User.Role.choices)
