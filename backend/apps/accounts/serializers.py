from django.contrib.auth import password_validation
from rest_framework import serializers

from .models import AuthSession, User, validate_timezone


class UserSerializer(serializers.ModelSerializer):
    email_verified = serializers.BooleanField(source="is_email_verified", read_only=True)
    is_platform_admin = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "full_name",
            "role",
            "status",
            "timezone",
            "email_verified",
            "is_platform_admin",
            "date_joined",
        ]
        read_only_fields = ["id", "email", "role", "status", "date_joined"]


class UserUpdateSerializer(serializers.ModelSerializer):
    """Only these fields are user-editable — role/status cannot be mass-assigned."""

    class Meta:
        model = User
        fields = ["full_name", "timezone"]


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(write_only=True, max_length=128, trim_whitespace=False)
    full_name = serializers.CharField(max_length=150)
    timezone = serializers.CharField(max_length=64, default="UTC", validators=[validate_timezone])

    def validate(self, attrs):  # type: ignore[no-untyped-def]
        candidate = User(email=attrs["email"].lower(), full_name=attrs["full_name"])
        try:
            password_validation.validate_password(attrs["password"], user=candidate)
        except Exception as exc:  # Django ValidationError
            raise serializers.ValidationError({"password": list(exc.messages)}) from exc
        return attrs


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=128)


class EmailSerializer(serializers.Serializer):
    email = serializers.EmailField()


class TokenSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=256)


class PasswordField(serializers.CharField):
    def __init__(self, **kwargs):  # type: ignore[no-untyped-def]
        kwargs.setdefault("write_only", True)
        kwargs.setdefault("trim_whitespace", False)
        kwargs.setdefault("max_length", 128)
        super().__init__(**kwargs)


class ResetPasswordSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=256)
    password = PasswordField()


class ChangePasswordSerializer(serializers.Serializer):
    current_password = PasswordField()
    new_password = PasswordField()


class PasswordConfirmSerializer(serializers.Serializer):
    password = PasswordField()


class AuthResponseSerializer(serializers.Serializer):
    access_token = serializers.CharField()
    access_token_expires_at = serializers.DateTimeField()
    user = UserSerializer()


class SessionSerializer(serializers.ModelSerializer):
    current = serializers.SerializerMethodField()

    class Meta:
        model = AuthSession
        fields = [
            "id",
            "created_at",
            "last_used_at",
            "expires_at",
            "ip_address",
            "user_agent",
            "current",
        ]

    def get_current(self, obj: AuthSession) -> bool:
        current = self.context.get("current_session_id")
        return current is not None and obj.id == current
