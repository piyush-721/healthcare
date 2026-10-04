"""Dashboard: "What do I need to know or do about my health today?"

Each section is only populated when the caller holds the matching permission
on the selected profile; otherwise it is ``null`` so the UI can hide it.
"""

from __future__ import annotations

from datetime import timedelta

from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.appointments.models import Appointment
from apps.family.models import CaregiverAccess
from apps.labs.models import LabReport
from apps.medications.serializers import TodayDoseSerializer
from apps.medications.services import doses_for_day, profile_timezone
from apps.notifications.models import Notification
from apps.profiles.access import Perm
from apps.profiles.api import ProfileAccessMixin
from apps.profiles.models import PatientProfile
from apps.treatments.models import TreatmentTask

from .services import TimelineQuery, build_timeline


class DashboardView(ProfileAccessMixin, APIView):
    @extend_schema(
        tags=["dashboard"], parameters=[OpenApiParameter("profile", str)], responses={200: dict}
    )
    def get(self, request: Request) -> Response:
        access = self.resolve_profile_access(perm=None)
        profile = access.profile
        tz = profile_timezone(profile)
        now = timezone.now()
        today = now.astimezone(tz).date()
        user = request.user

        data: dict = {
            "profile": {
                "id": str(profile.id),
                "full_name": profile.full_name,
                "is_self": profile.is_self,
                "access_role": access.role,
                "permissions": sorted(access.permissions),
            },
            "date": today.isoformat(),
            "upcoming_appointments": None,
            "appointments_needing_update": None,
            "todays_doses": None,
            "pending_tasks": None,
            "recent_lab_reports": None,
            "recent_events": [],
        }
        if access.can(Perm.VIEW_APPOINTMENTS):
            upcoming = (
                Appointment.objects.filter(
                    profile=profile, status=Appointment.Status.SCHEDULED, scheduled_at__gte=now
                )
                .select_related("provider")
                .order_by("scheduled_at")[:4]
            )
            data["upcoming_appointments"] = [
                {
                    "id": str(a.id),
                    "title": a.title,
                    "scheduled_at": a.scheduled_at,
                    "provider": a.provider.name if a.provider else a.provider_name,
                    "location": a.location,
                    "kind": a.kind,
                }
                for a in upcoming
            ]
            data["appointments_needing_update"] = Appointment.objects.filter(
                profile=profile, status=Appointment.Status.SCHEDULED, scheduled_at__lt=now
            ).count()
        if access.can(Perm.VIEW_MEDICATIONS):
            data["todays_doses"] = TodayDoseSerializer(
                doses_for_day(profile, today), many=True
            ).data
        if access.can(Perm.VIEW_TREATMENT_PLANS):
            tasks = (
                TreatmentTask.objects.filter(
                    plan__profile=profile,
                    status=TreatmentTask.Status.PENDING,
                    plan__status="ACTIVE",
                )
                .select_related("plan")
                .order_by("due_date", "position")[:6]
            )
            data["pending_tasks"] = [
                {
                    "id": str(t.id),
                    "title": t.title,
                    "kind": t.kind,
                    "due_date": t.due_date,
                    "plan_id": str(t.plan_id),
                    "plan_title": t.plan.title,
                    "overdue": bool(t.due_date and t.due_date < today),
                }
                for t in tasks
            ]
        if access.can(Perm.VIEW_LAB_RESULTS):
            reports = (
                LabReport.objects.filter(
                    profile=profile, report_date__gte=today - timedelta(days=180)
                )
                .prefetch_related("results")
                .order_by("-report_date")[:3]
            )
            data["recent_lab_reports"] = [
                {
                    "id": str(r.id),
                    "title": r.title,
                    "report_date": r.report_date,
                    "lab_name": r.lab_name,
                    "result_count": len(r.results.all()),
                }
                for r in reports
            ]
        timeline = build_timeline(
            access,
            TimelineQuery(types=set(), start=None, end=today, search="", before=None, limit=6),
            tz,
        )
        data["recent_events"] = timeline["results"]

        data["family"] = {
            "dependents": PatientProfile.objects.filter(owner=user, is_self=False).count(),
            "caregivers": CaregiverAccess.objects.filter(
                profile__owner=user, status=CaregiverAccess.Status.ACTIVE
            ).count(),
            "caring_for": CaregiverAccess.objects.filter(
                caregiver=user, status=CaregiverAccess.Status.ACTIVE
            ).count(),
        }
        data["unread_notifications"] = Notification.objects.filter(
            user=user, show_in_app=True, read_at__isnull=True
        ).count()
        return Response(data)
