from django.db import transaction
from django.db.models import Prefetch
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from apps.audit.models import AuditEvent
from apps.profiles.access import Perm
from apps.profiles.api import ProfileScopedViewSet

from .models import TreatmentPlan, TreatmentTask
from .serializers import TreatmentPlanSerializer, TreatmentTaskSerializer


class TreatmentPlanViewSet(ProfileScopedViewSet):
    queryset = TreatmentPlan.objects.all()
    serializer_class = TreatmentPlanSerializer
    view_permission = Perm.VIEW_TREATMENT_PLANS
    manage_permission = Perm.MANAGE_TREATMENT_PLANS
    filterset_fields = ["status"]
    search_fields = ["title", "description"]
    ordering_fields = ["start_date", "next_review_date", "created_at"]

    def base_queryset(self):  # type: ignore[no-untyped-def]
        return TreatmentPlan.objects.select_related("provider").prefetch_related(
            Prefetch("tasks", queryset=TreatmentTask.objects.select_related("completed_by"))
        )

    @extend_schema(
        tags=["treatments"],
        request=TreatmentTaskSerializer,
        responses={201: TreatmentTaskSerializer},
    )
    @action(detail=True, methods=["post"])
    def tasks(self, request: Request, pk: str) -> Response:
        plan = self.get_object()
        serializer = TreatmentTaskSerializer(
            data=request.data, context=self.get_serializer_context()
        )
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            position = serializer.validated_data.pop("position", None)
            if position is None:
                position = plan.tasks.count()
            task = serializer.save(plan=plan, position=position)
            self.audit(AuditEvent.RECORD_CREATED, plan, resource_detail="TreatmentTask")
        return Response(TreatmentTaskSerializer(task).data, status=status.HTTP_201_CREATED)

    def _task(self, plan: TreatmentPlan, task_id: str) -> TreatmentTask:
        task = plan.tasks.filter(id=task_id).first()
        if task is None:
            raise NotFound("Task not found.")
        return task

    @extend_schema(
        tags=["treatments"],
        request=TreatmentTaskSerializer,
        responses={200: TreatmentTaskSerializer},
    )
    @action(detail=True, methods=["patch", "delete"], url_path=r"tasks/(?P<task_id>[0-9a-f-]{36})")
    def task_detail(self, request: Request, pk: str, task_id: str) -> Response:
        plan = self.get_object()
        task = self._task(plan, task_id)
        if request.method == "DELETE":
            task.delete()
            self.audit(AuditEvent.RECORD_DELETED, plan, resource_detail="TreatmentTask")
            return Response(status=status.HTTP_204_NO_CONTENT)
        serializer = TreatmentTaskSerializer(
            task, data=request.data, partial=True, context=self.get_serializer_context()
        )
        serializer.is_valid(raise_exception=True)
        task = serializer.save()
        self.audit(
            AuditEvent.RECORD_UPDATED,
            plan,
            resource_detail="TreatmentTask",
            fields=sorted(serializer.validated_data.keys()),
        )
        return Response(TreatmentTaskSerializer(task).data)
