from django.db.models import Count, Max, Prefetch
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from apps.profiles.access import Perm
from apps.profiles.api import ProfileScopedViewSet

from .models import LabReport, LabResult, normalize_test_key
from .serializers import LabReportSerializer, TrendPointSerializer, TrendResponseSerializer


class LabReportViewSet(ProfileScopedViewSet):
    queryset = LabReport.objects.all()
    serializer_class = LabReportSerializer
    view_permission = Perm.VIEW_LAB_RESULTS
    manage_permission = Perm.MANAGE_LAB_RESULTS
    filterset_fields = {"report_date": ["gte", "lte"]}
    search_fields = ["title", "lab_name", "results__test_name"]
    ordering_fields = ["report_date", "created_at"]
    ordering = ["-report_date"]

    def base_queryset(self):  # type: ignore[no-untyped-def]
        return (
            LabReport.objects.select_related("ordered_by", "document")
            .prefetch_related(Prefetch("results", queryset=LabResult.objects.order_by("test_name")))
            .distinct()
        )

    @extend_schema(
        tags=["labs"], parameters=[OpenApiParameter("profile", str)], responses={200: dict}
    )
    @action(detail=False, methods=["get"])
    def tests(self, request: Request) -> Response:
        """Distinct numeric tests for this profile, for the trend picker."""
        access = self.get_list_access()
        rows = (
            LabResult.objects.filter(report__profile=access.profile, value__isnull=False)
            .values("test_key")
            .annotate(
                count=Count("id"),
                latest=Max("report__report_date"),
                test_name=Max("test_name"),
                unit=Max("unit"),
            )
            .order_by("test_name")
        )
        return Response(list(rows))

    @extend_schema(
        tags=["labs"],
        parameters=[OpenApiParameter("profile", str), OpenApiParameter("test", str, required=True)],
        responses={200: TrendResponseSerializer},
    )
    @action(detail=False, methods=["get"])
    def trends(self, request: Request) -> Response:
        access = self.get_list_access()
        test = request.query_params.get("test", "")
        if not test:
            raise ValidationError({"test": ["Choose a test."]})
        results = (
            LabResult.objects.filter(
                report__profile=access.profile,
                test_key=normalize_test_key(test),
                value__isnull=False,
            )
            .select_related("report")
            .order_by("report__report_date", "created_at")
        )
        return Response(
            {
                "test_key": normalize_test_key(test),
                "points": TrendPointSerializer(results, many=True).data,
            }
        )
