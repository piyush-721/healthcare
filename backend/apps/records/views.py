from django.db.models import Prefetch
from django.http import FileResponse
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.request import Request
from rest_framework.response import Response

from apps.audit.models import AuditEvent
from apps.audit.services import record_event
from apps.common.storage import get_private_storage
from apps.common.throttles import UploadThrottle
from apps.profiles.access import Perm
from apps.profiles.api import ProfileScopedViewSet

from .models import CareProvider, MedicalDocument, MedicalRecord
from .serializers import (
    CareProviderSerializer,
    DocumentUploadSerializer,
    MedicalDocumentSerializer,
    MedicalRecordSerializer,
)
from .services import store_document


def document_file_response(document: MedicalDocument) -> FileResponse:
    if document.scan_status == MedicalDocument.ScanStatus.PENDING:
        raise ValidationError({"detail": ["This file is still being scanned. Try again shortly."]})
    if not document.is_available:
        raise NotFound("This file is not available.")
    try:
        stream = get_private_storage().open(document.storage_key)
    except FileNotFoundError as exc:
        raise NotFound("This file is not available.") from exc
    response = FileResponse(
        stream,
        as_attachment=True,
        filename=document.original_filename,
        content_type=document.content_type,
    )
    response["Cache-Control"] = "private, no-store"
    response["Content-Security-Policy"] = "sandbox; default-src 'none'"
    return response


class CareProviderViewSet(ProfileScopedViewSet):
    queryset = CareProvider.objects.all()
    serializer_class = CareProviderSerializer
    view_permission = Perm.VIEW_PROFILE
    manage_permission = Perm.MANAGE_PROFILE
    filterset_fields = ["kind"]
    search_fields = ["name", "specialty", "organization"]
    ordering_fields = ["name", "created_at"]


class MedicalRecordViewSet(ProfileScopedViewSet):
    queryset = MedicalRecord.objects.all()
    serializer_class = MedicalRecordSerializer
    view_permission = Perm.VIEW_DOCUMENTS
    manage_permission = Perm.UPLOAD_DOCUMENTS
    filterset_fields = {"record_type": ["exact"], "record_date": ["gte", "lte"]}
    search_fields = ["title", "description", "provider__name"]
    ordering_fields = ["record_date", "created_at", "title"]
    ordering = ["-record_date"]

    def base_queryset(self):  # type: ignore[no-untyped-def]
        return MedicalRecord.objects.select_related("provider").prefetch_related(
            Prefetch("documents", queryset=MedicalDocument.objects.order_by("-created_at"))
        )

    def create_kwargs(self, access):  # type: ignore[no-untyped-def]
        return {"profile": access.profile, "created_by": self.request.user}


class MedicalDocumentViewSet(ProfileScopedViewSet):
    queryset = MedicalDocument.objects.all()
    view_permission = Perm.VIEW_DOCUMENTS
    manage_permission = Perm.UPLOAD_DOCUMENTS
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filterset_fields = {"document_type": ["exact"], "record": ["exact"], "scan_status": ["exact"]}
    search_fields = ["title", "original_filename"]
    ordering_fields = ["created_at", "document_date", "title"]

    def get_throttles(self):  # type: ignore[no-untyped-def]
        if self.action == "create":
            return [UploadThrottle()]
        return super().get_throttles()

    def get_serializer_class(self):  # type: ignore[no-untyped-def]
        return DocumentUploadSerializer if self.action == "create" else MedicalDocumentSerializer

    def base_queryset(self):  # type: ignore[no-untyped-def]
        qs = MedicalDocument.objects.select_related("record", "uploaded_by")
        if self.action == "list":
            archived = self.request.query_params.get("archived") in ("1", "true")
            qs = qs.filter(archived_at__isnull=not archived)
        return qs

    @extend_schema(
        tags=["records"],
        request={"multipart/form-data": DocumentUploadSerializer},
        responses={201: MedicalDocumentSerializer},
    )
    def create(self, request: Request, *args, **kwargs) -> Response:  # type: ignore[no-untyped-def]
        access = self.get_create_access()
        serializer = DocumentUploadSerializer(
            data=request.data, context=self.get_serializer_context()
        )
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        upload = data.pop("file")
        document = store_document(
            profile=access.profile, upload=upload, uploaded_by=request.user, request=request, **data
        )
        document.refresh_from_db()
        return Response(
            MedicalDocumentSerializer(document, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(tags=["records"], responses={(200, "application/octet-stream"): bytes})
    @action(detail=True, methods=["get"])
    def download(self, request: Request, pk: str) -> FileResponse:
        document = self.get_object()
        response = document_file_response(document)
        record_event(AuditEvent.DOCUMENT_VIEWED, request=request, target=document)
        return response

    @extend_schema(tags=["records"], request=None, responses={200: MedicalDocumentSerializer})
    @action(detail=True, methods=["post"])
    def archive(self, request: Request, pk: str) -> Response:
        document = self.get_object()
        if document.archived_at is None:
            document.archived_at = timezone.now()
            document.save(update_fields=["archived_at", "updated_at"])
            record_event(AuditEvent.DOCUMENT_ARCHIVED, request=request, target=document)
        return Response(MedicalDocumentSerializer(document).data)

    @extend_schema(tags=["records"], request=None, responses={200: MedicalDocumentSerializer})
    @action(detail=True, methods=["post"])
    def restore(self, request: Request, pk: str) -> Response:
        document = self.get_object()
        if document.archived_at is not None:
            document.archived_at = None
            document.save(update_fields=["archived_at", "updated_at"])
            self.audit(AuditEvent.RECORD_UPDATED, document, fields=["archived_at"])
        return Response(MedicalDocumentSerializer(document).data)
