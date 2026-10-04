from __future__ import annotations

from django.core.files.uploadedfile import UploadedFile
from django.db import transaction
from django.http import HttpRequest

from apps.audit.models import AuditEvent
from apps.audit.services import record_event
from apps.common.files import validate_upload
from apps.common.storage import get_private_storage
from apps.profiles.models import PatientProfile

from .models import MedicalDocument


def store_document(
    *,
    profile: PatientProfile,
    upload: UploadedFile,
    uploaded_by,
    request: HttpRequest,  # type: ignore[no-untyped-def]
    **fields,  # type: ignore[no-untyped-def]
) -> MedicalDocument:
    validated = validate_upload(upload)
    storage = get_private_storage()
    key = storage.save(upload, extension=validated.extension)
    try:
        with transaction.atomic():
            document = MedicalDocument.objects.create(
                profile=profile,
                storage_key=key,
                original_filename=validated.original_name,
                content_type=validated.content_type,
                size_bytes=validated.size,
                sha256=validated.sha256,
                uploaded_by=uploaded_by,
                **fields,
            )
            record_event(
                AuditEvent.DOCUMENT_UPLOADED,
                request=request,
                target=document,
                metadata={
                    "document_type": document.document_type,
                    "size_bytes": document.size_bytes,
                },
            )
            from .tasks import scan_document

            transaction.on_commit(lambda: scan_document.delay(str(document.id)))
    except Exception:
        storage.delete(key)
        raise
    return document
