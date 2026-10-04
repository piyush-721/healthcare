from rest_framework import serializers

from apps.profiles.api import ProfileRelatedField, ProfileScopedSerializer

from .models import CareProvider, MedicalDocument, MedicalRecord


class CareProviderSerializer(ProfileScopedSerializer):
    class Meta:
        model = CareProvider
        fields = [
            "id",
            "profile",
            "kind",
            "name",
            "specialty",
            "organization",
            "phone",
            "email",
            "address",
            "notes",
            "created_at",
            "updated_at",
        ]


class ProviderSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = CareProvider
        fields = ["id", "name", "kind", "specialty", "organization"]


class MedicalDocumentSerializer(ProfileScopedSerializer):
    """Never exposes ``storage_key``; downloads go through the authorized endpoint."""

    record = ProfileRelatedField(MedicalRecord, required=False, allow_null=True)
    record_title = serializers.CharField(source="record.title", read_only=True, default=None)
    is_available = serializers.BooleanField(read_only=True)
    uploaded_by_name = serializers.CharField(
        source="uploaded_by.full_name", read_only=True, default=None
    )

    class Meta:
        model = MedicalDocument
        fields = [
            "id",
            "profile",
            "record",
            "record_title",
            "title",
            "document_type",
            "document_date",
            "original_filename",
            "content_type",
            "size_bytes",
            "scan_status",
            "is_available",
            "uploaded_by_name",
            "archived_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "original_filename",
            "content_type",
            "size_bytes",
            "scan_status",
            "archived_at",
        ]


class DocumentUploadSerializer(MedicalDocumentSerializer):
    file = serializers.FileField(write_only=True)

    class Meta(MedicalDocumentSerializer.Meta):
        fields = [*MedicalDocumentSerializer.Meta.fields, "file"]


class MedicalRecordSerializer(ProfileScopedSerializer):
    provider = ProfileRelatedField(CareProvider, required=False, allow_null=True)
    provider_detail = ProviderSummarySerializer(source="provider", read_only=True)
    documents = serializers.SerializerMethodField()

    class Meta:
        model = MedicalRecord
        fields = [
            "id",
            "profile",
            "title",
            "record_type",
            "record_date",
            "provider",
            "provider_detail",
            "description",
            "documents",
            "created_at",
            "updated_at",
        ]

    def get_documents(self, obj: MedicalRecord) -> list[dict]:
        docs = [d for d in obj.documents.all() if d.archived_at is None]
        return MedicalDocumentSerializer(docs, many=True, context=self.context).data
