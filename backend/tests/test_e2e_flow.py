"""End-to-end acceptance flow from the build plan (§31 Integration, §46 Acceptance).

Exercises the real HTTP API, cookies, CSRF-protected auth endpoints, Celery
tasks (eager) and email delivery exactly as the frontend would.
"""

import re
from datetime import timedelta

from django.core import mail
from django.utils import timezone
from rest_framework.test import APIClient

from .conftest import PDF_BYTES, upload_file

PASSWORD = "Acceptance-Flow-Pass-42"


def _csrf(client: APIClient) -> str:
    return client.get("/api/v1/auth/csrf/").json()["csrf_token"]


def test_full_patient_journey(db, django_capture_on_commit_callbacks):
    browser = APIClient(enforce_csrf_checks=True)

    # 1. Create an account
    with django_capture_on_commit_callbacks(execute=True):
        response = browser.post(
            "/api/v1/auth/register/",
            {
                "email": "priya@example.com",
                "password": PASSWORD,
                "full_name": "Priya Patel",
                "timezone": "Asia/Kolkata",
            },
            format="json",
        )
    assert response.status_code == 201

    # 2. Verify email using the link from the inbox
    token = re.search(r"#token=([\w\-]+)", mail.outbox[-1].body).group(1)
    assert browser.post("/api/v1/auth/verify-email/", {"token": token}).status_code == 200

    # 3. Log in (CSRF double-submit + HttpOnly refresh cookie)
    response = browser.post(
        "/api/v1/auth/login/",
        {"email": "priya@example.com", "password": PASSWORD},
        HTTP_X_CSRFTOKEN=_csrf(browser),
        format="json",
    )
    assert response.status_code == 200
    browser.credentials(HTTP_AUTHORIZATION=f"Bearer {response.json()['access_token']}")

    # Silent refresh works with the cookie alone
    refreshed = browser.post("/api/v1/auth/refresh/", HTTP_X_CSRFTOKEN=_csrf(browser))
    assert refreshed.status_code == 200
    browser.credentials(HTTP_AUTHORIZATION=f"Bearer {refreshed.json()['access_token']}")

    # 4. Complete health profile
    profile = browser.patch(
        "/api/v1/profile/",
        {"date_of_birth": "1988-02-14", "blood_type": "O+", "sex": "FEMALE"},
        format="json",
    ).json()
    assert profile["blood_type"] == "O+"
    browser.post("/api/v1/allergies/", {"substance": "Penicillin", "severity": "SEVERE"})

    # 5. Add a family member
    child = browser.post(
        "/api/v1/family/",
        {"full_name": "Aarav Patel", "relationship_to_owner": "CHILD"},
        format="json",
    )
    assert child.status_code == 201

    # 6. Add a medication
    medication = browser.post(
        "/api/v1/medications/",
        {
            "name": "Metformin",
            "dosage": "500 mg",
            "frequency": "TWICE_DAILY",
            "start_date": timezone.now().date().isoformat(),
            "schedules": [{"time_of_day": "08:00"}, {"time_of_day": "20:00"}],
        },
        format="json",
    )
    assert medication.status_code == 201

    # 7. Create an appointment
    appointment = browser.post(
        "/api/v1/appointments/",
        {
            "title": "Follow-up consultation",
            "scheduled_at": (timezone.now() + timedelta(days=10)).isoformat(),
        },
        format="json",
    )
    assert appointment.status_code == 201

    # 8. Upload a medical document (scanned asynchronously)
    with django_capture_on_commit_callbacks(execute=True):
        document = browser.post(
            "/api/v1/documents/",
            {"file": upload_file("cbc.pdf"), "title": "CBC report", "document_type": "LAB_REPORT"},
            format="multipart",
        )
    assert document.status_code == 201
    document_id = document.json()["id"]
    assert browser.get(f"/api/v1/documents/{document_id}/").json()["scan_status"] == "CLEAN"

    # 9. Add lab results linked to the document
    lab = browser.post(
        "/api/v1/lab-reports/",
        {
            "title": "Complete blood count",
            "report_date": timezone.now().date().isoformat(),
            "document": document_id,
            "results": [
                {
                    "test_name": "Hemoglobin",
                    "value": "13.2",
                    "unit": "g/dL",
                    "reference_low": "12.0",
                    "reference_high": "16.0",
                }
            ],
        },
        format="json",
    )
    assert lab.status_code == 201

    # 10. Create a treatment plan
    plan = browser.post(
        "/api/v1/treatment-plans/",
        {"title": "Post-consultation follow-up", "start_date": timezone.now().date().isoformat()},
    ).json()
    browser.post(
        f"/api/v1/treatment-plans/{plan['id']}/tasks/", {"title": "Blood test", "kind": "TEST"}
    )

    # 11. View the unified timeline
    timeline = browser.get("/api/v1/timeline/").json()["results"]
    types = {event["type"] for event in timeline}
    assert {
        "APPOINTMENT",
        "MEDICATION_STARTED",
        "DOCUMENT_UPLOADED",
        "LAB_REPORT",
        "TREATMENT_PLAN",
    } <= types

    # 12. Create a limited share
    share = browser.post(
        "/api/v1/shares/",
        {
            "recipient_name": "Dr. Sharma",
            "scopes": ["PROFILE", "MEDICATIONS", "LAB_RESULTS", "DOCUMENTS"],
            "duration_hours": 24,
        },
        format="json",
    ).json()

    # 13. Provider accesses shared data via the authorized flow
    doctor = APIClient()
    header = {"HTTP_X_SHARE_TOKEN": share["access_token"]}
    assert doctor.get("/api/v1/shared/", **header).json()["patient_name"] == "Priya Patel"
    assert doctor.get("/api/v1/shared/medications/", **header).status_code == 200
    assert doctor.get("/api/v1/shared/appointments/", **header).status_code == 403  # not shared
    download = doctor.get(f"/api/v1/shared/documents/{document_id}/download/", **header)
    assert b"".join(download.streaming_content) == PDF_BYTES

    # 14. Revoke the share
    assert browser.post(f"/api/v1/shares/{share['id']}/revoke/").json()["state"] == "REVOKED"

    # 15. Revoked access is denied
    denied = doctor.get("/api/v1/shared/medications/", **header)
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "SHARE_REVOKED"

    # 16. Receive notifications
    from apps.notifications.tasks import dispatch_appointment_reminders

    browser.post(
        "/api/v1/appointments/",
        {
            "title": "Dentist",
            "reminder_minutes_before": 60,
            "scheduled_at": (timezone.now() + timedelta(minutes=30)).isoformat(),
        },
        format="json",
    )
    with django_capture_on_commit_callbacks(execute=True):
        dispatch_appointment_reminders()
    notifications = browser.get("/api/v1/notifications/").json()["results"]
    assert any(n["title"] == "Upcoming appointment" for n in notifications)

    # 17. Review security activity
    activity = browser.get("/api/v1/auth/security-activity/").json()["results"]
    assert {"SIGNUP", "EMAIL_VERIFIED", "LOGIN"} <= {e["event_type"] for e in activity}

    # 18. Log out securely
    assert browser.post("/api/v1/auth/logout/", HTTP_X_CSRFTOKEN=_csrf(browser)).status_code == 204
    assert browser.get("/api/v1/auth/me/").status_code == 401
    assert browser.post("/api/v1/auth/refresh/", HTTP_X_CSRFTOKEN=_csrf(browser)).status_code == 401
