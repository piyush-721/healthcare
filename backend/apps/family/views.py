from django.db import transaction
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.models import AuditEvent
from apps.audit.services import record_event
from apps.profiles.models import PatientProfile
from apps.profiles.serializers import DependentProfileCreateSerializer, PatientProfileSerializer

from . import services
from .models import CaregiverAccess
from .serializers import (
    CaregiverAccessSerializer,
    CaregiverInviteSerializer,
    CaregiverUpdateSerializer,
)


class FamilyOverviewView(APIView):
    """Everything family-related for the signed-in user in one call."""

    @extend_schema(tags=["family"], responses={200: dict})
    def get(self, request: Request) -> Response:
        user = request.user
        context = {"request": request}
        dependents = PatientProfile.objects.filter(owner=user, is_self=False)
        caregivers = CaregiverAccess.objects.filter(
            profile__owner=user,
            status__in=[CaregiverAccess.Status.PENDING, CaregiverAccess.Status.ACTIVE],
        ).select_related("profile", "caregiver", "granted_by")
        caring_for = CaregiverAccess.objects.filter(
            caregiver=user, status=CaregiverAccess.Status.ACTIVE
        ).select_related("profile", "caregiver", "granted_by")
        invitations = services.pending_invitations_for(user)
        return Response(
            {
                "dependents": PatientProfileSerializer(dependents, many=True, context=context).data,
                "caregivers": CaregiverAccessSerializer(caregivers, many=True).data,
                "caring_for": CaregiverAccessSerializer(caring_for, many=True).data,
                "pending_invitations": CaregiverAccessSerializer(invitations, many=True).data,
            }
        )

    @extend_schema(
        tags=["family"],
        request=DependentProfileCreateSerializer,
        responses={201: PatientProfileSerializer},
    )
    def post(self, request: Request) -> Response:
        """Add a dependent family member (a profile you manage as guardian)."""
        serializer = DependentProfileCreateSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            profile = serializer.save(owner=request.user, is_self=False)
            record_event(
                AuditEvent.RECORD_CREATED,
                request=request,
                target=profile,
                profile_id=profile.id,
                metadata={"resource": "PatientProfile"},
            )
        return Response(
            PatientProfileSerializer(profile, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class CaregiverViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Caregiver grants on profiles the caller owns. Only owners can grant access."""

    serializer_class = CaregiverAccessSerializer
    filterset_fields = ["profile", "status"]
    ordering_fields = ["created_at"]

    def get_queryset(self):  # type: ignore[no-untyped-def]
        return CaregiverAccess.objects.filter(profile__owner=self.request.user).select_related(
            "profile", "caregiver", "granted_by"
        )

    @extend_schema(
        tags=["family"],
        request=CaregiverInviteSerializer,
        responses={201: CaregiverAccessSerializer},
    )
    def create(self, request: Request) -> Response:
        serializer = CaregiverInviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        profile = PatientProfile.objects.filter(id=data["profile"], owner=request.user).first()
        if profile is None:
            raise NotFound("Profile not found.")
        grant = services.invite_caregiver(
            profile=profile,
            granted_by=request.user,
            email=data["email"],
            relationship=data.get("relationship", ""),
            permissions=data["permissions"],
            expires_at=data.get("expires_at"),
            request=request,
        )
        return Response(CaregiverAccessSerializer(grant).data, status=status.HTTP_201_CREATED)

    @extend_schema(
        tags=["family"],
        request=CaregiverUpdateSerializer,
        responses={200: CaregiverAccessSerializer},
    )
    def partial_update(self, request: Request, pk: str) -> Response:
        grant = self.get_object()
        if grant.status not in (CaregiverAccess.Status.ACTIVE, CaregiverAccess.Status.PENDING):
            raise NotFound("This caregiver access is no longer active.")
        serializer = CaregiverUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        grant = services.update_grant(
            grant=grant,
            permissions=data.get("permissions"),
            relationship=data.get("relationship"),
            expires_at=data.get("expires_at"),
            expires_at_provided="expires_at" in data,
            request=request,
        )
        return Response(CaregiverAccessSerializer(grant).data)

    @extend_schema(tags=["family"], request=None, responses={200: CaregiverAccessSerializer})
    @action(detail=True, methods=["post"])
    def revoke(self, request: Request, pk: str) -> Response:
        grant = self.get_object()
        services.revoke_grant(grant=grant, request=request, actor=request.user)
        grant.refresh_from_db()
        return Response(CaregiverAccessSerializer(grant).data)


class InvitationViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Caregiver invitations addressed to the caller's verified email."""

    queryset = CaregiverAccess.objects.none()
    serializer_class = CaregiverAccessSerializer
    pagination_class = None
    filter_backends: list = []

    def get_queryset(self):  # type: ignore[no-untyped-def]
        return services.pending_invitations_for(self.request.user)

    @extend_schema(tags=["family"], request=None, responses={200: CaregiverAccessSerializer})
    @action(detail=True, methods=["post"])
    def accept(self, request: Request, pk: str) -> Response:
        grant = services.respond_to_invitation(
            grant_id=pk, user=request.user, accept=True, request=request
        )
        return Response(CaregiverAccessSerializer(grant).data)

    @extend_schema(tags=["family"], request=None, responses={200: CaregiverAccessSerializer})
    @action(detail=True, methods=["post"])
    def decline(self, request: Request, pk: str) -> Response:
        grant = services.respond_to_invitation(
            grant_id=pk, user=request.user, accept=False, request=request
        )
        return Response(CaregiverAccessSerializer(grant).data)


class CaringForViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Grants where the caller is the caregiver. A caregiver may step down at any time."""

    serializer_class = CaregiverAccessSerializer
    pagination_class = None
    filter_backends: list = []

    def get_queryset(self):  # type: ignore[no-untyped-def]
        return CaregiverAccess.objects.filter(
            caregiver=self.request.user, status=CaregiverAccess.Status.ACTIVE
        ).select_related("profile", "granted_by", "caregiver")

    @extend_schema(tags=["family"], request=None, responses={204: None})
    @action(detail=True, methods=["post"])
    def leave(self, request: Request, pk: str) -> Response:
        grant = self.get_object()
        services.revoke_grant(grant=grant, request=request, actor=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)
