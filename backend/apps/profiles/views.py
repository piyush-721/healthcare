from django.db import transaction
from drf_spectacular.utils import extend_schema
from rest_framework import generics, mixins, status, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from apps.audit.models import AuditEvent
from apps.audit.services import record_event

from .access import Perm, accessible_profiles, resolve_access
from .api import ProfileScopedViewSet
from .models import (
    Allergy,
    EmergencyContact,
    MedicalCondition,
    PatientProfile,
    VaccinationRecord,
    VitalRecord,
)
from .serializers import (
    AllergySerializer,
    DependentProfileCreateSerializer,
    EmergencyContactSerializer,
    MedicalConditionSerializer,
    PatientProfileSerializer,
    VaccinationRecordSerializer,
    VitalRecordSerializer,
)
from .services import get_self_profile


class PatientProfileViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Profiles the caller can access: their own, dependents they guard, and shared ones."""

    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    pagination_class = None
    filter_backends: list = []

    def get_queryset(self):  # type: ignore[no-untyped-def]
        return accessible_profiles(self.request.user).select_related("owner")

    def get_serializer_class(self):  # type: ignore[no-untyped-def]
        return (
            DependentProfileCreateSerializer
            if self.action == "create"
            else PatientProfileSerializer
        )

    def get_object(self) -> PatientProfile:
        profile = super().get_object()
        access = resolve_access(self.request.user, profile)
        needed = Perm.VIEW_PROFILE if self.request.method == "GET" else Perm.MANAGE_PROFILE
        if access is None or not access.can(needed):
            raise PermissionDenied("You do not have permission for this profile.")
        return profile

    def perform_create(self, serializer):  # type: ignore[no-untyped-def]
        with transaction.atomic():
            profile = serializer.save(owner=self.request.user, is_self=False)
            record_event(
                AuditEvent.RECORD_CREATED,
                request=self.request,
                target=profile,
                profile_id=profile.id,
                metadata={"resource": "PatientProfile"},
            )

    def perform_update(self, serializer):  # type: ignore[no-untyped-def]
        profile = serializer.save()
        record_event(
            AuditEvent.RECORD_UPDATED,
            request=self.request,
            target=profile,
            profile_id=profile.id,
            metadata={
                "resource": "PatientProfile",
                "fields": sorted(serializer.validated_data.keys()),
            },
        )

    def destroy(self, request: Request, *args, **kwargs) -> Response:  # type: ignore[no-untyped-def]
        profile = super().get_object()
        if profile.owner_id != request.user.id:
            raise PermissionDenied("Only the profile owner can delete a profile.")
        if profile.is_self:
            raise ValidationError(
                {
                    "detail": [
                        "Your own profile cannot be deleted. " "Deactivate your account instead."
                    ]
                }
            )
        with transaction.atomic():
            record_event(
                AuditEvent.RECORD_DELETED,
                request=request,
                target=profile,
                profile_id=profile.id,
                metadata={"resource": "PatientProfile"},
            )
            profile.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MyProfileView(generics.RetrieveUpdateAPIView):
    """Shortcut to the caller's own profile (``/api/v1/profile/``)."""

    serializer_class = PatientProfileSerializer
    http_method_names = ["get", "patch", "options"]

    def get_object(self) -> PatientProfile:
        return get_self_profile(self.request.user)

    @extend_schema(tags=["profiles"])
    def patch(self, request: Request, *args, **kwargs) -> Response:  # type: ignore[no-untyped-def]
        response = super().partial_update(request, *args, **kwargs)
        record_event(
            AuditEvent.RECORD_UPDATED,
            request=request,
            profile_id=response.data["id"],
            target_type="PatientProfile",
            target_id=str(response.data["id"]),
            metadata={"resource": "PatientProfile"},
        )
        return response


class _HealthInfoViewSet(ProfileScopedViewSet):
    view_permission = Perm.VIEW_PROFILE
    manage_permission = Perm.MANAGE_PROFILE


class EmergencyContactViewSet(_HealthInfoViewSet):
    queryset = EmergencyContact.objects.all()
    serializer_class = EmergencyContactSerializer
    ordering_fields = ["name", "created_at"]


class AllergyViewSet(_HealthInfoViewSet):
    queryset = Allergy.objects.all()
    serializer_class = AllergySerializer
    filterset_fields = ["severity"]
    search_fields = ["substance", "reaction"]
    ordering_fields = ["substance", "noted_on", "created_at"]


class MedicalConditionViewSet(_HealthInfoViewSet):
    queryset = MedicalCondition.objects.all()
    serializer_class = MedicalConditionSerializer
    filterset_fields = ["status"]
    search_fields = ["name"]
    ordering_fields = ["name", "diagnosed_on", "created_at"]


class VitalRecordViewSet(_HealthInfoViewSet):
    queryset = VitalRecord.objects.all()
    serializer_class = VitalRecordSerializer
    filterset_fields = ["vital_type"]
    ordering_fields = ["measured_at"]
    ordering = ["-measured_at"]


class VaccinationRecordViewSet(_HealthInfoViewSet):
    queryset = VaccinationRecord.objects.all()
    serializer_class = VaccinationRecordSerializer
    search_fields = ["vaccine_name"]
    ordering_fields = ["administered_on", "next_dose_due"]
    ordering = ["-administered_on"]
