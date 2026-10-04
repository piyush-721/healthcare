from datetime import date, timedelta

from django.db import transaction
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

from . import services
from .models import Medication, MedicationLog
from .serializers import (
    LogDoseSerializer,
    MedicationLogSerializer,
    MedicationSerializer,
    TodayDoseSerializer,
    TodayDosesResponseSerializer,
)


class MedicationViewSet(ProfileScopedViewSet):
    queryset = Medication.objects.all()
    serializer_class = MedicationSerializer
    view_permission = Perm.VIEW_MEDICATIONS
    manage_permission = Perm.MANAGE_MEDICATIONS
    filterset_fields = ["status", "frequency"]
    search_fields = ["name", "instructions"]
    ordering_fields = ["name", "start_date", "created_at"]

    def base_queryset(self):  # type: ignore[no-untyped-def]
        return Medication.objects.select_related(
            "prescribed_by", "profile__owner"
        ).prefetch_related("schedules")

    def _set_status(self, request: Request, new_status: str) -> Response:
        medication = self.get_object()
        allowed = {
            Medication.Status.PAUSED: {Medication.Status.ACTIVE},
            Medication.Status.ACTIVE: {Medication.Status.PAUSED},
            Medication.Status.COMPLETED: {Medication.Status.ACTIVE, Medication.Status.PAUSED},
            Medication.Status.STOPPED: {Medication.Status.ACTIVE, Medication.Status.PAUSED},
        }
        if medication.status not in allowed[new_status]:
            raise ValidationError(
                {
                    "status": [
                        f"Cannot change a {medication.status.lower()} "
                        f"medication to {new_status.lower()}."
                    ]
                }
            )
        medication.status = new_status
        medication.paused_at = timezone.now() if new_status == Medication.Status.PAUSED else None
        medication.save(update_fields=["status", "paused_at", "updated_at"])
        self.audit(AuditEvent.RECORD_UPDATED, medication, fields=["status"], status=new_status)
        return Response(
            MedicationSerializer(medication, context=self.get_serializer_context()).data
        )

    @extend_schema(tags=["medications"], request=None, responses={200: MedicationSerializer})
    @action(detail=True, methods=["post"])
    def pause(self, request: Request, pk: str) -> Response:
        return self._set_status(request, Medication.Status.PAUSED)

    @extend_schema(tags=["medications"], request=None, responses={200: MedicationSerializer})
    @action(detail=True, methods=["post"])
    def resume(self, request: Request, pk: str) -> Response:
        return self._set_status(request, Medication.Status.ACTIVE)

    @extend_schema(tags=["medications"], request=None, responses={200: MedicationSerializer})
    @action(detail=True, methods=["post"])
    def complete(self, request: Request, pk: str) -> Response:
        return self._set_status(request, Medication.Status.COMPLETED)

    @extend_schema(tags=["medications"], request=None, responses={200: MedicationSerializer})
    @action(detail=True, methods=["post"])
    def stop(self, request: Request, pk: str) -> Response:
        return self._set_status(request, Medication.Status.STOPPED)

    @extend_schema(
        tags=["medications"], request=LogDoseSerializer, responses={201: MedicationLogSerializer}
    )
    @action(detail=True, methods=["post"], url_path="log")
    def log_dose(self, request: Request, pk: str) -> Response:
        medication = self.get_object()
        serializer = LogDoseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        schedule = None
        if data.get("schedule"):
            schedule = medication.schedules.filter(id=data["schedule"]).first()
            if schedule is None:
                raise ValidationError({"schedule": ["Unknown schedule for this medication."]})
        taken_at = data.get("taken_at")
        if data["status"] == MedicationLog.Status.TAKEN and taken_at is None:
            taken_at = timezone.now()
        if taken_at and taken_at > timezone.now() + timedelta(minutes=5):
            raise ValidationError({"taken_at": ["A dose can't be logged in the future."]})
        with transaction.atomic():
            if schedule is not None:
                log, _ = MedicationLog.objects.update_or_create(
                    schedule=schedule,
                    scheduled_for=data["scheduled_for"],
                    defaults={
                        "medication": medication,
                        "status": data["status"],
                        "taken_at": taken_at,
                        "note": data["note"],
                        "logged_by": request.user,
                    },
                )
            else:
                log = MedicationLog.objects.create(
                    medication=medication,
                    status=data["status"],
                    taken_at=taken_at,
                    note=data["note"],
                    logged_by=request.user,
                )
        return Response(MedicationLogSerializer(log).data, status=status.HTTP_201_CREATED)

    @extend_schema(tags=["medications"], responses={200: MedicationLogSerializer(many=True)})
    @action(detail=True, methods=["get"])
    def logs(self, request: Request, pk: str) -> Response:
        medication = self.get_object()
        page = self.paginate_queryset(medication.logs.select_related("logged_by"))
        return self.get_paginated_response(MedicationLogSerializer(page, many=True).data)

    @extend_schema(
        tags=["medications"],
        parameters=[OpenApiParameter("days", int, description="1-90, default 30")],
        responses={200: dict},
    )
    @action(detail=True, methods=["get"])
    def adherence(self, request: Request, pk: str) -> Response:
        medication = self.get_object()
        try:
            days = min(max(int(request.query_params.get("days", 30)), 1), 90)
        except ValueError as exc:
            raise ValidationError({"days": ["Must be a number."]}) from exc
        return Response(services.adherence(medication, days))

    @extend_schema(
        tags=["medications"],
        parameters=[OpenApiParameter("profile", str), OpenApiParameter("date", date)],
        responses={200: TodayDosesResponseSerializer},
    )
    @action(detail=False, methods=["get"])
    def today(self, request: Request) -> Response:
        access = self.get_list_access()
        tz = services.profile_timezone(access.profile)
        day_param = request.query_params.get("date")
        try:
            day = (
                date.fromisoformat(day_param) if day_param else timezone.now().astimezone(tz).date()
            )
        except ValueError as exc:
            raise ValidationError({"date": ["Use YYYY-MM-DD."]}) from exc
        doses = services.doses_for_day(access.profile, day)
        return Response(
            {
                "date": day.isoformat(),
                "timezone": str(tz),
                "doses": TodayDoseSerializer(doses, many=True).data,
            }
        )
