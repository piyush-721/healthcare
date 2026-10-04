import logging

from django.db import transaction
from django.db.models.signals import post_delete
from django.dispatch import receiver

from apps.common.storage import get_private_storage

from .models import MedicalDocument

logger = logging.getLogger(__name__)


@receiver(post_delete, sender=MedicalDocument)
def remove_stored_file(sender, instance: MedicalDocument, **kwargs) -> None:  # type: ignore[no-untyped-def]
    """Delete the private file once the metadata row deletion is committed."""
    key = instance.storage_key

    def _delete() -> None:
        try:
            get_private_storage().delete(key)
        except Exception:
            logger.exception("Failed to delete stored file", extra={"document": str(instance.pk)})

    transaction.on_commit(_delete)
