from rest_framework.permissions import BasePermission


class IsPlatformAdmin(BasePermission):
    """Grants access to platform administration endpoints only.

    Being an admin confers **no** access to health data: health endpoints
    authorize purely through profile ownership and caregiver grants.
    """

    message = "Platform administrator access is required."

    def has_permission(self, request, view) -> bool:  # type: ignore[no-untyped-def]
        user = request.user
        return bool(user and user.is_authenticated and user.is_platform_admin)
