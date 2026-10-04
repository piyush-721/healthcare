from datetime import timedelta

import pytest
from django.core import mail
from django.utils import timezone
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent, AuditLog
from apps.sharing.models import DataShare, ShareAccessLog

from .conftest import PDF_BYTES, upload_file


@pytest.fixture
def provider() -> APIClient:
    return APIClient()


@pytest.fixture
def create_share(alice_client, django_capture_on_commit_callbacks):
    def _create(scopes=("PROFILE", "MEDICATIONS", "LAB_RESULTS"), hours=24, **extra):
        with django_capture_on_commit_callbacks(execute=True):
            response = alice_client.post(
                "/api/v1/shares/",
                {
                    "recipient_name": "Dr. Sharma",
                    "scopes": list(scopes),
                    "duration_hours": hours,
                    "purpose": "Second opinion",
                    **extra,
                },
                format="json",
            )
        assert response.status_code == 201, response.content
        return response.json()

    return _create


def _get(client, path, token):
    return client.get(f"/api/v1/shared/{path}", HTTP_X_SHARE_TOKEN=token)


class TestShareLifecycle:
    def test_create_returns_token_once_and_stores_hash(self, create_share, alice_client):
        share = create_share()
        assert share["access_token"] and share["share_url"].endswith(share["access_token"])
        assert "#token=" in share["share_url"]
        stored = DataShare.objects.get(id=share["id"])
        assert stored.token_hash != share["access_token"]
        detail = alice_client.get(f"/api/v1/shares/{share['id']}/").json()
        assert "access_token" not in detail
        assert detail["state"] == "ACTIVE"
        assert AuditLog.objects.filter(event_type=AuditEvent.SHARE_CREATED).exists()

    def test_recipient_email_sent_when_requested(self, create_share):
        create_share(recipient_email="doc@clinic.example", send_email=True)
        assert mail.outbox[-1].to == ["doc@clinic.example"]
        assert "/shared#token=" in mail.outbox[-1].body

    def test_duration_limits(self, alice_client):
        response = alice_client.post(
            "/api/v1/shares/",
            {"recipient_name": "X", "scopes": ["PROFILE"], "duration_hours": 24 * 31},
            format="json",
        )
        assert response.status_code == 400

    def test_requires_scopes(self, alice_client):
        response = alice_client.post(
            "/api/v1/shares/",
            {"recipient_name": "X", "scopes": [], "duration_hours": 1},
            format="json",
        )
        assert response.status_code == 400

    def test_other_user_cannot_see_or_revoke(self, create_share, bob_client):
        share = create_share()
        assert bob_client.get(f"/api/v1/shares/{share['id']}/").status_code == 404
        assert bob_client.post(f"/api/v1/shares/{share['id']}/revoke/").status_code == 404


class TestProviderAccess:
    def test_summary_and_shared_sections(self, create_share, alice_client, provider):
        alice_client.post("/api/v1/allergies/", {"substance": "Penicillin"})
        alice_client.post(
            "/api/v1/medications/",
            {"name": "Metformin", "dosage": "500 mg", "start_date": "2026-10-01"},
            format="json",
        )
        token = create_share()["access_token"]
        summary = _get(provider, "", token).json()
        assert summary["patient_name"] == "Alice Patient"
        assert summary["scopes"] == ["LAB_RESULTS", "MEDICATIONS", "PROFILE"]
        meds = _get(provider, "medications/", token).json()["medications"]
        assert [m["name"] for m in meds] == ["Metformin"]
        profile = _get(provider, "profile/", token).json()
        assert profile["allergies"][0]["substance"] == "Penicillin"
        assert "phone" not in profile["profile"]

    def test_unshared_section_denied(self, create_share, provider):
        token = create_share(scopes=["MEDICATIONS"])["access_token"]
        response = _get(provider, "appointments/", token)
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "SHARE_SCOPE_DENIED"
        assert ShareAccessLog.objects.filter(outcome="DENIED_SCOPE").exists()

    def test_invalid_token_denied(self, provider, db):
        response = _get(provider, "medications/", "not-a-real-token")
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "SHARE_NOT_FOUND"
        assert _get(provider, "", "").status_code == 404

    def test_expired_share_denied(self, create_share, provider):
        share = create_share()
        DataShare.objects.filter(id=share["id"]).update(
            expires_at=timezone.now() - timedelta(seconds=1)
        )
        response = _get(provider, "medications/", share["access_token"])
        assert response.status_code == 403
        assert response.json()["error"] == {
            "code": "SHARE_EXPIRED",
            "message": "Access denied. This sharing permission has expired.",
        }
        assert ShareAccessLog.objects.filter(outcome="DENIED_EXPIRED").exists()

    def test_revoked_share_denied_immediately(self, create_share, alice_client, provider):
        share = create_share()
        assert _get(provider, "medications/", share["access_token"]).status_code == 200
        revoked = alice_client.post(f"/api/v1/shares/{share['id']}/revoke/").json()
        assert revoked["state"] == "REVOKED"
        response = _get(provider, "medications/", share["access_token"])
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "SHARE_REVOKED"
        assert AuditLog.objects.filter(event_type=AuditEvent.SHARE_REVOKED).exists()

    def test_access_is_logged_and_counted(self, create_share, alice_client, provider):
        share = create_share()
        _get(provider, "medications/", share["access_token"])
        _get(provider, "profile/", share["access_token"])
        logs = alice_client.get(f"/api/v1/shares/{share['id']}/access-logs/").json()["results"]
        assert {log["section"] for log in logs} == {"medications", "profile"}
        assert alice_client.get(f"/api/v1/shares/{share['id']}/").json()["access_count"] == 2
        assert AuditLog.objects.filter(event_type=AuditEvent.SHARED_RECORD_ACCESSED).count() == 2

    def test_share_token_does_not_grant_api_access(self, create_share, provider):
        token = create_share()["access_token"]
        provider.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        assert provider.get("/api/v1/medications/").status_code == 401

    def test_share_scoped_to_one_profile(self, create_share, bob_client, provider):
        bob_client.post(
            "/api/v1/medications/",
            {"name": "BobMed", "dosage": "1", "start_date": "2026-10-01"},
            format="json",
        )
        token = create_share()["access_token"]
        meds = _get(provider, "medications/", token).json()["medications"]
        assert "BobMed" not in [m["name"] for m in meds]


class TestSharedDocuments:
    @pytest.fixture
    def documents(self, alice_client, django_capture_on_commit_callbacks):
        ids = {}
        for doc_type in ("LAB_REPORT", "MEDICAL_BILL"):
            with django_capture_on_commit_callbacks(execute=True):
                ids[doc_type] = alice_client.post(
                    "/api/v1/documents/",
                    {"file": upload_file(), "title": doc_type, "document_type": doc_type},
                    format="multipart",
                ).json()["id"]
        return ids

    def test_documents_scope_excludes_bills(self, create_share, documents, provider):
        token = create_share(scopes=["DOCUMENTS"])["access_token"]
        docs = _get(provider, "documents/", token).json()["documents"]
        assert [d["document_type"] for d in docs] == ["LAB_REPORT"]
        bill = provider.get(
            f"/api/v1/shared/documents/{documents['MEDICAL_BILL']}/download/",
            HTTP_X_SHARE_TOKEN=token,
        )
        assert bill.status_code == 404
        report = provider.get(
            f"/api/v1/shared/documents/{documents['LAB_REPORT']}/download/",
            HTTP_X_SHARE_TOKEN=token,
        )
        assert report.status_code == 200
        assert b"".join(report.streaming_content) == PDF_BYTES

    def test_financial_scope_only_bills(self, create_share, documents, provider):
        token = create_share(scopes=["FINANCIAL"])["access_token"]
        docs = _get(provider, "documents/", token).json()
        assert [d["document_type"] for d in docs["documents"]] == ["MEDICAL_BILL"]
        assert docs["records"] == []

    def test_download_denied_without_document_scope(self, create_share, documents, provider):
        token = create_share(scopes=["MEDICATIONS"])["access_token"]
        response = provider.get(
            f"/api/v1/shared/documents/{documents['LAB_REPORT']}/download/",
            HTTP_X_SHARE_TOKEN=token,
        )
        assert response.status_code == 403
