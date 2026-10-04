from django.http import FileResponse
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.appointments.models import Appointment
from apps.appointments.serializers import AppointmentSerializer
from apps.common.throttles import ShareAccessThrottle
from apps.labs.models import LabReport
from apps.labs.serializers import LabReportSerializer
from apps.medications.models import Medication
from apps.medications.serializers import MedicationSerializer
from apps.profiles.models import (
    Allergy,
    MedicalCondition,
    PatientProfile,
    VaccinationRecord,
    VitalRecord,
)
from apps.profiles.serializers import (
    AllergySerializer,
    MedicalConditionSerializer,
    VaccinationRecordSerializer,
    VitalRecordSerializer,
)
from apps.records.models import MedicalDocument, MedicalRecord
from apps.records.serializers import MedicalDocumentSerializer
from apps.records.views import document_file_response
from apps.treatments.models import TreatmentPlan
from apps.treatments.serializers import TreatmentPlanSerializer

from . import services
from .models import DataShare, ShareScope
from .serializers import (
    CreatedShareSerializer,
    CreateShareSerializer,
    DataShareSerializer,
    ShareAccessLogSerializer,
    SharedProfileSerializer,
    ShareSummarySerializer,
)

SHARE_TOKEN_HEADER = "X-Share-Token"


# ---------------------------------------------------------------------------
# Owner-facing management
# ---------------------------------------------------------------------------
class DataShareViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = DataShareSerializer
    filterset_fields = ["profile"]
    ordering_fields = ["created_at", "expires_at"]

    def get_queryset(self):  # type: ignore[no-untyped-def]
        return DataShare.objects.filter(profile__owner=self.request.user).select_related(
            "profile", "revoked_by"
        )

    @extend_schema(
        tags=["sharing"], request=CreateShareSerializer, responses={201: CreatedShareSerializer}
    )
    def create(self, request: Request) -> Response:
        serializer = CreateShareSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if data.get("profile"):
            profile = PatientProfile.objects.filter(id=data["profile"], owner=request.user).first()
        else:
            profile = PatientProfile.objects.filter(owner=request.user, is_self=True).first()
        if profile is None:
            raise NotFound("Profile not found.")
        share, raw = services.create_share(
            profile=profile,
            created_by=request.user,
            recipient_name=data["recipient_name"],
            recipient_email=data["recipient_email"],
            purpose=data["purpose"],
            scopes=list(data["scopes"]),
            duration_hours=data["duration_hours"],
            send_email=data["send_email"],
            request=request,
        )
        share.access_token = raw  # type: ignore[attr-defined]
        share.share_url = services.share_link(raw)  # type: ignore[attr-defined]
        return Response(CreatedShareSerializer(share).data, status=status.HTTP_201_CREATED)

    @extend_schema(tags=["sharing"], request=None, responses={200: DataShareSerializer})
    @action(detail=True, methods=["post"])
    def revoke(self, request: Request, pk: str) -> Response:
        share = services.revoke_share(self.get_object(), by=request.user, request=request)
        return Response(DataShareSerializer(share).data)

    @extend_schema(tags=["sharing"], responses={200: ShareAccessLogSerializer(many=True)})
    @action(detail=True, methods=["get"], url_path="access-logs")
    def access_logs(self, request: Request, pk: str) -> Response:
        share = self.get_object()
        page = self.paginate_queryset(share.access_logs.all())
        return self.get_paginated_response(ShareAccessLogSerializer(page, many=True).data)


# ---------------------------------------------------------------------------
# Recipient-facing, token-authorized, read-only access
# ---------------------------------------------------------------------------
DOCUMENT_SCOPES = (ShareScope.DOCUMENTS, ShareScope.FINANCIAL)

SECTIONS: dict[str, tuple[str, ...]] = {
    "profile": (ShareScope.PROFILE,),
    "medications": (ShareScope.MEDICATIONS,),
    "appointments": (ShareScope.APPOINTMENTS,),
    # Bills are only visible with FINANCIAL; other documents need DOCUMENTS.
    "documents": DOCUMENT_SCOPES,
    "lab-results": (ShareScope.LAB_RESULTS,),
    "treatment-plans": (ShareScope.TREATMENT_PLANS,),
}


def _allowed_document_types(share: DataShare) -> list[str]:
    types = [
        t
        for t in MedicalDocument.DocumentType.values
        if t != MedicalDocument.DocumentType.MEDICAL_BILL
    ]
    allowed: list[str] = []
    if ShareScope.DOCUMENTS in share.scopes:
        allowed += types
    if ShareScope.FINANCIAL in share.scopes:
        allowed.append(MedicalDocument.DocumentType.MEDICAL_BILL)
    return allowed


class SharedAccessBase(APIView):
    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_classes = [ShareAccessThrottle]

    def authorize(
        self, request: Request, section: str, scopes: tuple[str, ...] | None
    ) -> DataShare:
        return services.authorize_share_access(
            request.headers.get(SHARE_TOKEN_HEADER), section, scopes, request
        )


class SharedSummaryView(SharedAccessBase):
    @extend_schema(
        tags=["shared-access"],
        operation_id="shared_summary",
        parameters=[
            OpenApiParameter(SHARE_TOKEN_HEADER, str, OpenApiParameter.HEADER, required=True)
        ],
        responses={200: ShareSummarySerializer},
    )
    def get(self, request: Request) -> Response:
        share = self.authorize(request, "summary", None)
        return Response(ShareSummarySerializer(share).data)


class SharedSectionView(SharedAccessBase):
    @extend_schema(
        tags=["shared-access"],
        parameters=[
            OpenApiParameter(SHARE_TOKEN_HEADER, str, OpenApiParameter.HEADER, required=True)
        ],
        responses={200: dict},
    )
    def get(self, request: Request, section: str) -> Response:
        if section not in SECTIONS:
            raise NotFound("Unknown section.")
        share = self.authorize(request, section, SECTIONS[section])
        profile = share.profile
        return Response(getattr(self, f"_{section.replace('-', '_')}")(share, profile))

    @staticmethod
    def _profile(share: DataShare, profile: PatientProfile) -> dict:
        return {
            "profile": SharedProfileSerializer(profile).data,
            "allergies": AllergySerializer(Allergy.objects.filter(profile=profile), many=True).data,
            "conditions": MedicalConditionSerializer(
                MedicalCondition.objects.filter(profile=profile), many=True
            ).data,
            "vaccinations": VaccinationRecordSerializer(
                VaccinationRecord.objects.filter(profile=profile), many=True
            ).data,
            "vitals": VitalRecordSerializer(
                VitalRecord.objects.filter(profile=profile)[:50], many=True
            ).data,
        }

    @staticmethod
    def _medications(share: DataShare, profile: PatientProfile) -> dict:
        meds = (
            Medication.objects.filter(profile=profile)
            .exclude(status=Medication.Status.STOPPED)
            .select_related("prescribed_by")
            .prefetch_related("schedules")
        )
        return {"medications": MedicationSerializer(meds, many=True).data}

    @staticmethod
    def _appointments(share: DataShare, profile: PatientProfile) -> dict:
        appts = (
            Appointment.objects.filter(profile=profile)
            .select_related("provider")
            .prefetch_related("notes__author")
            .order_by("-scheduled_at")[:50]
        )
        return {"appointments": AppointmentSerializer(appts, many=True).data}

    @staticmethod
    def _documents(share: DataShare, profile: PatientProfile) -> dict:
        docs = MedicalDocument.objects.filter(
            profile=profile,
            archived_at__isnull=True,
            scan_status=MedicalDocument.ScanStatus.CLEAN,
            document_type__in=_allowed_document_types(share),
        ).select_related("record", "uploaded_by")
        records = []
        if ShareScope.DOCUMENTS in share.scopes:
            records = [
                {
                    "id": str(r.id),
                    "title": r.title,
                    "record_type": r.record_type,
                    "record_date": r.record_date,
                    "description": r.description,
                    "provider": r.provider.name if r.provider else None,
                }
                for r in MedicalRecord.objects.filter(profile=profile).select_related("provider")
            ]
        return {"records": records, "documents": MedicalDocumentSerializer(docs, many=True).data}

    @staticmethod
    def _lab_results(share: DataShare, profile: PatientProfile) -> dict:
        reports = (
            LabReport.objects.filter(profile=profile)
            .select_related("ordered_by", "document")
            .prefetch_related("results")
        )
        return {"lab_reports": LabReportSerializer(reports, many=True).data}

    @staticmethod
    def _treatment_plans(share: DataShare, profile: PatientProfile) -> dict:
        plans = (
            TreatmentPlan.objects.filter(profile=profile)
            .exclude(status=TreatmentPlan.Status.ARCHIVED)
            .select_related("provider")
            .prefetch_related("tasks")
        )
        return {"treatment_plans": TreatmentPlanSerializer(plans, many=True).data}


class SharedDocumentDownloadView(SharedAccessBase):
    @extend_schema(
        tags=["shared-access"],
        parameters=[
            OpenApiParameter(SHARE_TOKEN_HEADER, str, OpenApiParameter.HEADER, required=True)
        ],
        responses={(200, "application/octet-stream"): bytes},
    )
    def get(self, request: Request, pk: str) -> FileResponse:
        share = self.authorize(request, "document-download", DOCUMENT_SCOPES)
        document = MedicalDocument.objects.filter(
            id=pk,
            profile=share.profile,
            archived_at__isnull=True,
            document_type__in=_allowed_document_types(share),
        ).first()
        if document is None:
            raise NotFound("Document not found.")
        return document_file_response(document)
