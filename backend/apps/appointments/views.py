from django.db.models import Prefetch
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from apps.audit.models import AuditEvent
from apps.profiles.access import Perm
from apps.profiles.api import ProfileScopedViewSet

from .models import Appointment, AppointmentNote
from .serializers import AppointmentNoteSerializer, AppointmentSerializer, StatusChangeSerializer


class AppointmentViewSet(ProfileScopedViewSet):
    queryset = Appointment.objects.all()
    serializer_class = AppointmentSerializer
    view_permission = Perm.VIEW_APPOINTMENTS
    manage_permission = Perm.MANAGE_APPOINTMENTS
    filterset_fields = {
        "status": ["exact", "in"],
        "scheduled_at": ["gte", "lte"],
        "provider": ["exact"],
    }
    search_fields = ["title", "reason", "provider_name", "provider__name", "location"]
    ordering_fields = ["scheduled_at", "created_at"]
    ordering = ["scheduled_at"]

    def base_queryset(self):  # type: ignore[no-untyped-def]
        qs = Appointment.objects.select_related("provider").prefetch_related(
            Prefetch("notes", queryset=AppointmentNote.objects.select_related("author"))
        )
        view = self.request.query_params.get("view")
        now = timezone.now()
        if view == "upcoming":
            qs = qs.filter(status=Appointment.Status.SCHEDULED, scheduled_at__gte=now)
        elif view == "past":
            qs = qs.exclude(status=Appointment.Status.SCHEDULED, scheduled_at__gte=now).order_by(
                "-scheduled_at"
            )
        return qs

    @extend_schema(
        tags=["appointments"], parameters=[OpenApiParameter("view", str, enum=["upcoming", "past"])]
    )
    def list(self, request: Request, *args, **kwargs) -> Response:  # type: ignore[no-untyped-def]
        return super().list(request, *args, **kwargs)

    @extend_schema(
        tags=["appointments"],
        request=StatusChangeSerializer,
        responses={200: AppointmentSerializer},
    )
    @action(detail=True, methods=["post"], url_path="status")
    def change_status(self, request: Request, pk: str) -> Response:
        appointment = self.get_object()
        serializer = StatusChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_status = serializer.validated_data["status"]
        if (
            new_status in (Appointment.Status.COMPLETED, Appointment.Status.MISSED)
            and appointment.scheduled_at > timezone.now()
        ):
            raise ValidationError({"status": ["A future appointment can only be cancelled."]})
        if (
            new_status == Appointment.Status.SCHEDULED
            and appointment.status != Appointment.Status.CANCELLED
        ):
            raise ValidationError({"status": ["Only a cancelled appointment can be restored."]})
        appointment.status = new_status
        appointment.cancellation_reason = (
            serializer.validated_data.get("cancellation_reason", "")
            if new_status == Appointment.Status.CANCELLED
            else ""
        )
        appointment.save(update_fields=["status", "cancellation_reason", "updated_at"])
        self.audit(AuditEvent.RECORD_UPDATED, appointment, fields=["status"], status=new_status)
        return Response(
            AppointmentSerializer(appointment, context=self.get_serializer_context()).data
        )

    @extend_schema(
        tags=["appointments"],
        request=AppointmentNoteSerializer,
        responses={201: AppointmentNoteSerializer},
    )
    @action(detail=True, methods=["post"])
    def notes(self, request: Request, pk: str) -> Response:
        appointment = self.get_object()
        serializer = AppointmentNoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        note = serializer.save(appointment=appointment, author=request.user)
        self.audit(AuditEvent.RECORD_CREATED, appointment, resource_detail="AppointmentNote")
        return Response(AppointmentNoteSerializer(note).data, status=status.HTTP_201_CREATED)

    @extend_schema(tags=["appointments"], request=None, responses={204: None})
    @action(detail=True, methods=["delete"], url_path=r"notes/(?P<note_id>[0-9a-f-]{36})")
    def delete_note(self, request: Request, pk: str, note_id: str) -> Response:
        appointment = self.get_object()
        note = appointment.notes.filter(id=note_id).first()
        if note is None:
            raise ValidationError({"note": ["Note not found."]})
        note.delete()
        self.audit(AuditEvent.RECORD_DELETED, appointment, resource_detail="AppointmentNote")
        return Response(status=status.HTTP_204_NO_CONTENT)
