import pytest
from django.test import override_settings

from apps.audit.models import AuditEvent, AuditLog
from apps.common.files import safe_filename
from apps.common.storage import get_private_storage
from apps.profiles.access import Perm
from apps.records.models import MedicalDocument

from .conftest import EICAR, PDF_BYTES, PNG_BYTES, grant_caregiver, self_profile, upload_file


@pytest.fixture
def upload(alice_client, django_capture_on_commit_callbacks):
    def _upload(name="report.pdf", content=PDF_BYTES, client=None, **extra):
        data = {
            "file": upload_file(name, content),
            "title": "Blood report",
            "document_type": "LAB_REPORT",
            **extra,
        }
        with django_capture_on_commit_callbacks(execute=True):
            return (client or alice_client).post("/api/v1/documents/", data, format="multipart")

    return _upload


class TestUpload:
    def test_upload_stores_privately_and_scans(self, upload, alice):
        response = upload()
        assert response.status_code == 201, response.content
        body = response.json()
        assert "storage_key" not in body
        doc = MedicalDocument.objects.get(id=body["id"])
        assert doc.scan_status == MedicalDocument.ScanStatus.CLEAN
        assert doc.sha256 and doc.size_bytes == len(PDF_BYTES)
        assert doc.uploaded_by == alice
        assert get_private_storage().exists(doc.storage_key)
        assert AuditLog.objects.filter(
            event_type=AuditEvent.DOCUMENT_UPLOADED, target_id=str(doc.id)
        ).exists()

    def test_png_accepted(self, upload):
        assert upload("scan.png", PNG_BYTES).status_code == 201

    @pytest.mark.parametrize("name", ["evil.exe", "script.html", "archive.zip", "noext"])
    def test_disallowed_extensions_rejected(self, upload, name):
        response = upload(name)
        assert response.status_code == 400
        assert "file" in response.json()["error"]["fields"]

    def test_content_must_match_extension(self, upload):
        response = upload("fake.pdf", b"MZ\x90\x00 this is an executable")
        assert response.status_code == 400
        assert "does not match" in str(response.json())

    def test_size_limit_enforced(self, upload):
        with override_settings(MAX_UPLOAD_SIZE_BYTES=100):
            response = upload("big.pdf", PDF_BYTES + b"0" * 200)
        assert response.status_code == 400
        assert "MB or smaller" in str(response.json())

    def test_empty_file_rejected(self, upload):
        assert upload("empty.pdf", b"").status_code == 400

    def test_malware_is_quarantined_and_not_downloadable(self, upload, alice_client):
        response = upload("eicar.pdf", PDF_BYTES + EICAR)
        assert response.status_code == 201
        doc = MedicalDocument.objects.get(id=response.json()["id"])
        assert doc.scan_status == MedicalDocument.ScanStatus.INFECTED
        assert not get_private_storage().exists(doc.storage_key)
        assert alice_client.get(f"/api/v1/documents/{doc.id}/download/").status_code == 404
        assert AuditLog.objects.filter(event_type=AuditEvent.DOCUMENT_QUARANTINED).exists()

    def test_pending_scan_blocks_download(self, alice_client):
        data = {"file": upload_file(), "title": "Pending", "document_type": "OTHER"}
        response = alice_client.post("/api/v1/documents/", data, format="multipart")
        doc_id = response.json()["id"]  # on_commit not executed → still pending
        download = alice_client.get(f"/api/v1/documents/{doc_id}/download/")
        assert download.status_code == 400

    def test_path_traversal_filename_is_sanitized(self, upload):
        response = upload("../../etc/pass<wd>.pdf")
        assert response.status_code == 201
        assert response.json()["original_filename"] == "pass_wd_.pdf"

    def test_safe_filename_helper(self):
        assert safe_filename("..\\..\\windows\\sys.pdf") == "sys.pdf"
        assert safe_filename("") == "document"
        assert len(safe_filename("a" * 300 + ".pdf")) <= 120


class TestDownload:
    def test_owner_download_streams_file_and_audits(self, upload, alice_client):
        doc_id = upload().json()["id"]
        response = alice_client.get(f"/api/v1/documents/{doc_id}/download/")
        assert response.status_code == 200
        assert b"".join(response.streaming_content) == PDF_BYTES
        assert response["Content-Disposition"].startswith("attachment")
        assert "no-store" in response["Cache-Control"]
        assert AuditLog.objects.filter(
            event_type=AuditEvent.DOCUMENT_VIEWED, target_id=doc_id
        ).exists()

    def test_other_user_cannot_download(self, upload, bob_client):
        doc_id = upload().json()["id"]
        assert bob_client.get(f"/api/v1/documents/{doc_id}/download/").status_code == 404

    def test_caregiver_upload_permission(self, alice, bob, bob_client, upload):
        grant_caregiver(alice, bob, [Perm.VIEW_DOCUMENTS])
        profile = str(self_profile(alice).id)
        assert upload(client=bob_client, profile=profile).status_code == 403
        grant_caregiver_update = alice.owned_profiles.get(is_self=True).caregiver_grants.first()
        grant_caregiver_update.permissions = [Perm.VIEW_DOCUMENTS, Perm.UPLOAD_DOCUMENTS]
        grant_caregiver_update.save()
        assert upload(client=bob_client, profile=profile).status_code == 201


class TestArchiveAndDelete:
    def test_archive_hides_from_default_list(self, upload, alice_client):
        doc_id = upload().json()["id"]
        assert alice_client.post(f"/api/v1/documents/{doc_id}/archive/").status_code == 200
        assert alice_client.get("/api/v1/documents/").json()["count"] == 0
        assert alice_client.get("/api/v1/documents/?archived=true").json()["count"] == 1
        alice_client.post(f"/api/v1/documents/{doc_id}/restore/")
        assert alice_client.get("/api/v1/documents/").json()["count"] == 1

    def test_delete_removes_file(self, upload, alice_client, django_capture_on_commit_callbacks):
        doc_id = upload().json()["id"]
        key = MedicalDocument.objects.get(id=doc_id).storage_key
        with django_capture_on_commit_callbacks(execute=True):
            assert alice_client.delete(f"/api/v1/documents/{doc_id}/").status_code == 204
        assert not get_private_storage().exists(key)


class TestRecords:
    def test_record_with_documents(self, alice_client, upload):
        record = alice_client.post(
            "/api/v1/records/",
            {
                "title": "Discharge",
                "record_type": "DISCHARGE_SUMMARY",
                "record_date": "2026-09-01",
            },
        ).json()
        upload(record=record["id"])
        detail = alice_client.get(f"/api/v1/records/{record['id']}/").json()
        assert len(detail["documents"]) == 1

    def test_filter_and_search(self, alice_client):
        for title, kind in [("Cardiology visit", "CONSULTATION"), ("X-ray", "IMAGING")]:
            alice_client.post(
                "/api/v1/records/",
                {"title": title, "record_type": kind, "record_date": "2026-09-01"},
            )
        assert alice_client.get("/api/v1/records/?record_type=IMAGING").json()["count"] == 1
        assert alice_client.get("/api/v1/records/?search=cardio").json()["count"] == 1
