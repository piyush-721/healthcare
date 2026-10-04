import logging

from celery import shared_task
from django.utils import timezone

from apps.audit.models import AuditEvent
from apps.audit.services import record_event
from apps.common.scanning import get_scanner
from apps.common.storage import get_private_storage

from .models import MedicalDocument

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def scan_document(self, document_id: str) -> str:  # type: ignore[no-untyped-def]
    document = MedicalDocument.objects.filter(id=document_id).first()
    if document is None or document.scan_status != MedicalDocument.ScanStatus.PENDING:
        return "skipped"
    try:
        with get_private_storage().open(document.storage_key) as stream:
            result = get_scanner().scan(stream)
    except FileNotFoundError:
        document.scan_status = MedicalDocument.ScanStatus.FAILED
        document.scan_detail = "File missing"
    except Exception as exc:
        logger.exception("Document scan failed", extra={"document": document_id})
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc) from exc
        document.scan_status = MedicalDocument.ScanStatus.FAILED
        document.scan_detail = "Scanner error"
    else:
        if result.clean:
            document.scan_status = MedicalDocument.ScanStatus.CLEAN
        else:
            document.scan_status = MedicalDocument.ScanStatus.INFECTED
            document.scan_detail = result.detail[:120]
            # Quarantine: drop the payload, keep metadata for the audit trail.
            get_private_storage().delete(document.storage_key)
            record_event(
                AuditEvent.DOCUMENT_QUARANTINED,
                target=document,
                metadata={"engine": result.engine, "signature": result.detail},
            )
    document.scanned_at = timezone.now()
    document.save(update_fields=["scan_status", "scan_detail", "scanned_at", "updated_at"])
    logger.info("document scanned", extra={"document": document_id, "status": document.scan_status})
    return document.scan_status
