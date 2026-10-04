from django.utils import timezone
from rest_framework import serializers

from apps.profiles.access import Perm

from .models import CaregiverAccess


class CaregiverAccessSerializer(serializers.ModelSerializer):
    profile_name = serializers.CharField(source="profile.full_name", read_only=True)
    caregiver_name = serializers.CharField(
        source="caregiver.full_name", read_only=True, default=None
    )
    granted_by_name = serializers.CharField(source="granted_by.full_name", read_only=True)
    is_expired = serializers.SerializerMethodField()

    class Meta:
        model = CaregiverAccess
        fields = [
            "id",
            "profile",
            "profile_name",
            "invite_email",
            "caregiver",
            "caregiver_name",
            "granted_by_name",
            "relationship",
            "permissions",
            "status",
            "invite_expires_at",
            "expires_at",
            "accepted_at",
            "revoked_at",
            "created_at",
            "is_expired",
        ]
        read_only_fields = fields

    def get_is_expired(self, obj: CaregiverAccess) -> bool:
        return obj.expires_at is not None and obj.expires_at <= timezone.now()


class _PermissionsMixin(serializers.Serializer):
    permissions = serializers.ListField(
        child=serializers.ChoiceField(choices=Perm.choices), allow_empty=False, max_length=20
    )
    expires_at = serializers.DateTimeField(required=False, allow_null=True)

    def validate_expires_at(self, value):  # type: ignore[no-untyped-def]
        if value is not None and value <= timezone.now():
            raise serializers.ValidationError("The end date must be in the future.")
        return value


class CaregiverInviteSerializer(_PermissionsMixin):
    profile = serializers.UUIDField()
    email = serializers.EmailField()
    relationship = serializers.CharField(
        max_length=60, required=False, allow_blank=True, default=""
    )


class CaregiverUpdateSerializer(_PermissionsMixin):
    relationship = serializers.CharField(max_length=60, required=False, allow_blank=True)

    def __init__(self, *args, **kwargs):  # type: ignore[no-untyped-def]
        super().__init__(*args, **kwargs)
        self.fields["permissions"].required = False
