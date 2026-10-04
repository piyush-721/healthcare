"""Authorization boundaries across every profile-scoped health-data endpoint.

Covers the plan's required cases:
* User A cannot read, modify or delete User B's data (IDOR).
* Caregivers only see what their grant allows, and only while it is active.
* Admins get no implicit access to health data.
* Related-object references cannot point into another person's profile.
"""

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.profiles.access import Perm

from .conftest import grant_caregiver, self_profile

TODAY = timezone.now().date().isoformat()
SOON = (timezone.now() + timedelta(days=3)).isoformat()

# endpoint, create payload, view perm, manage perm
RESOURCES = [
    (
        "allergies",
        {"substance": "Penicillin", "severity": "SEVERE"},
        Perm.VIEW_PROFILE,
        Perm.MANAGE_PROFILE,
    ),
    ("conditions", {"name": "Asthma"}, Perm.VIEW_PROFILE, Perm.MANAGE_PROFILE),
    (
        "emergency-contacts",
        {"name": "Sam", "phone": "+15550100"},
        Perm.VIEW_PROFILE,
        Perm.MANAGE_PROFILE,
    ),
    (
        "vitals",
        {
            "vital_type": "HEART_RATE",
            "value": "72",
            "unit": "bpm",
            "measured_at": timezone.now().isoformat(),
        },
        Perm.VIEW_PROFILE,
        Perm.MANAGE_PROFILE,
    ),
    (
        "vaccinations",
        {"vaccine_name": "Tetanus", "administered_on": TODAY},
        Perm.VIEW_PROFILE,
        Perm.MANAGE_PROFILE,
    ),
    ("providers", {"name": "Dr. Sharma", "kind": "DOCTOR"}, Perm.VIEW_PROFILE, Perm.MANAGE_PROFILE),
    (
        "records",
        {"title": "Consultation", "record_type": "CONSULTATION", "record_date": TODAY},
        Perm.VIEW_DOCUMENTS,
        Perm.UPLOAD_DOCUMENTS,
    ),
    (
        "medications",
        {
            "name": "Metformin",
            "dosage": "500 mg",
            "frequency": "TWICE_DAILY",
            "start_date": TODAY,
            "schedules": [{"time_of_day": "08:00"}],
        },
        Perm.VIEW_MEDICATIONS,
        Perm.MANAGE_MEDICATIONS,
    ),
    (
        "appointments",
        {"title": "Check-up", "scheduled_at": SOON},
        Perm.VIEW_APPOINTMENTS,
        Perm.MANAGE_APPOINTMENTS,
    ),
    (
        "lab-reports",
        {
            "title": "CBC",
            "report_date": TODAY,
            "results": [{"test_name": "Hemoglobin", "value": "13.2", "unit": "g/dL"}],
        },
        Perm.VIEW_LAB_RESULTS,
        Perm.MANAGE_LAB_RESULTS,
    ),
    (
        "treatment-plans",
        {"title": "Follow-up", "start_date": TODAY},
        Perm.VIEW_TREATMENT_PLANS,
        Perm.MANAGE_TREATMENT_PLANS,
    ),
]
IDS = [r[0] for r in RESOURCES]


def _create(client, endpoint, payload, profile=None):
    body = dict(payload)
    if profile is not None:
        body["profile"] = str(profile.id)
    response = client.post(f"/api/v1/{endpoint}/", body, format="json")
    assert response.status_code == 201, response.content
    return response.json()


@pytest.mark.parametrize(("endpoint", "payload", "view", "manage"), RESOURCES, ids=IDS)
class TestCrossUserIsolation:
    def test_owner_full_crud(self, alice_client, endpoint, payload, view, manage):
        item = _create(alice_client, endpoint, payload)
        assert alice_client.get(f"/api/v1/{endpoint}/{item['id']}/").status_code == 200
        listing = alice_client.get(f"/api/v1/{endpoint}/").json()["results"]
        assert [row["id"] for row in listing] == [item["id"]]
        assert alice_client.delete(f"/api/v1/{endpoint}/{item['id']}/").status_code == 204

    def test_other_user_cannot_read_update_or_delete(
        self, alice_client, bob_client, endpoint, payload, view, manage
    ):
        item = _create(alice_client, endpoint, payload)
        url = f"/api/v1/{endpoint}/{item['id']}/"
        assert bob_client.get(url).status_code == 404
        assert bob_client.patch(url, {"notes": "hacked"}, format="json").status_code == 404
        assert bob_client.delete(url).status_code == 404
        assert alice_client.get(url).status_code == 200

    def test_other_user_cannot_list_or_create_via_profile_param(
        self, alice, alice_client, bob_client, endpoint, payload, view, manage
    ):
        _create(alice_client, endpoint, payload)
        profile = self_profile(alice)
        assert bob_client.get(f"/api/v1/{endpoint}/?profile={profile.id}").status_code == 404
        body = {**payload, "profile": str(profile.id)}
        assert bob_client.post(f"/api/v1/{endpoint}/", body, format="json").status_code == 404
        # Bob's own default listing never contains Alice's data.
        assert bob_client.get(f"/api/v1/{endpoint}/").json()["results"] == []

    def test_caregiver_without_permission_is_denied(
        self, alice, bob, alice_client, bob_client, endpoint, payload, view, manage
    ):
        unrelated = [p for p in Perm.values if p not in (view, manage)][:1]
        grant_caregiver(alice, bob, unrelated)
        item = _create(alice_client, endpoint, payload)
        profile = self_profile(alice)
        assert bob_client.get(f"/api/v1/{endpoint}/?profile={profile.id}").status_code == 403
        assert bob_client.get(f"/api/v1/{endpoint}/{item['id']}/").status_code == 404

    def test_caregiver_view_only_cannot_modify(
        self, alice, bob, alice_client, bob_client, endpoint, payload, view, manage
    ):
        grant_caregiver(alice, bob, [view])
        item = _create(alice_client, endpoint, payload)
        profile = self_profile(alice)
        url = f"/api/v1/{endpoint}/{item['id']}/"
        assert bob_client.get(f"/api/v1/{endpoint}/?profile={profile.id}").status_code == 200
        assert bob_client.get(url).status_code == 200
        assert bob_client.patch(url, {}, format="json").status_code == 403
        assert bob_client.delete(url).status_code == 403
        body = {**payload, "profile": str(profile.id)}
        assert bob_client.post(f"/api/v1/{endpoint}/", body, format="json").status_code == 403

    def test_caregiver_with_manage_can_create(
        self, alice, bob, bob_client, endpoint, payload, view, manage
    ):
        grant_caregiver(alice, bob, [manage])
        profile = self_profile(alice)
        item = _create(bob_client, endpoint, payload, profile=profile)
        assert item["profile"] == str(profile.id)

    def test_expired_or_revoked_caregiver_access_stops_working(
        self, alice, bob, alice_client, bob_client, endpoint, payload, view, manage
    ):
        grant = grant_caregiver(alice, bob, [view])
        item = _create(alice_client, endpoint, payload)
        url = f"/api/v1/{endpoint}/{item['id']}/"
        assert bob_client.get(url).status_code == 200
        grant.expires_at = timezone.now() - timedelta(seconds=1)
        grant.save()
        assert bob_client.get(url).status_code == 404
        grant.expires_at = None
        grant.status = "REVOKED"
        grant.save()
        assert bob_client.get(url).status_code == 404

    def test_admin_has_no_implicit_access(
        self, make_user, client_for, alice, alice_client, endpoint, payload, view, manage
    ):
        admin = make_user("admin@example.com", role="ADMIN")
        admin_client = client_for(admin)
        item = _create(alice_client, endpoint, payload)
        profile = self_profile(alice)
        assert admin_client.get(f"/api/v1/{endpoint}/{item['id']}/").status_code == 404
        assert admin_client.get(f"/api/v1/{endpoint}/?profile={profile.id}").status_code == 404

    def test_unauthenticated_denied(self, api, db, endpoint, payload, view, manage):
        assert api.get(f"/api/v1/{endpoint}/").status_code == 401
        assert api.post(f"/api/v1/{endpoint}/", payload, format="json").status_code == 401


class TestCrossProfileReferences:
    """Foreign keys must not reference another person's objects (IDOR via relations)."""

    def test_cannot_link_foreign_provider(self, alice_client, bob_client):
        bob_provider = _create(bob_client, "providers", {"name": "Bob's Doctor"})
        response = alice_client.post(
            "/api/v1/appointments/",
            {
                "title": "Visit",
                "scheduled_at": SOON,
                "provider": bob_provider["id"],
            },
            format="json",
        )
        assert response.status_code == 400
        assert "provider" in response.json()["error"]["fields"]

    def test_cannot_link_foreign_record_to_medication(self, alice_client, bob_client):
        record = _create(
            bob_client,
            "records",
            {"title": "Rx", "record_type": "PRESCRIPTION", "record_date": TODAY},
        )
        response = alice_client.post(
            "/api/v1/medications/",
            {
                "name": "X",
                "dosage": "1",
                "start_date": TODAY,
                "source_record": record["id"],
            },
            format="json",
        )
        assert response.status_code == 400

    def test_cannot_move_object_to_another_profile(self, alice, bob, alice_client):
        item = _create(alice_client, "allergies", {"substance": "Dust"})
        response = alice_client.patch(
            f"/api/v1/allergies/{item['id']}/",
            {"profile": str(self_profile(bob).id)},
            format="json",
        )
        assert response.status_code == 200
        assert response.json()["profile"] == str(self_profile(alice).id)

    def test_caregiver_cannot_link_object_from_own_profile_into_patient(
        self, alice, bob, bob_client
    ):
        grant_caregiver(alice, bob, [Perm.MANAGE_APPOINTMENTS])
        bob_provider = _create(bob_client, "providers", {"name": "Bob's Doctor"})
        response = bob_client.post(
            "/api/v1/appointments/",
            {
                "profile": str(self_profile(alice).id),
                "title": "Visit",
                "scheduled_at": SOON,
                "provider": bob_provider["id"],
            },
            format="json",
        )
        assert response.status_code == 400


class TestProfiles:
    def test_profile_list_shows_only_accessible(self, alice, bob, alice_client, bob_client):
        ids = {p["id"] for p in bob_client.get("/api/v1/profiles/").json()}
        assert ids == {str(self_profile(bob).id)}
        grant_caregiver(alice, bob, [Perm.VIEW_MEDICATIONS])
        profiles = bob_client.get("/api/v1/profiles/").json()
        shared = next(p for p in profiles if p["id"] == str(self_profile(alice).id))
        assert shared["access_role"] == "CAREGIVER"
        assert shared["permissions"] == [Perm.VIEW_MEDICATIONS]

    def test_caregiver_without_view_profile_cannot_open_profile_detail(
        self, alice, bob, bob_client
    ):
        grant_caregiver(alice, bob, [Perm.VIEW_MEDICATIONS])
        response = bob_client.get(f"/api/v1/profiles/{self_profile(alice).id}/")
        assert response.status_code == 403

    def test_caregiver_cannot_delete_or_share_profile(self, alice, bob, bob_client):
        grant_caregiver(alice, bob, list(Perm.values))
        profile = self_profile(alice)
        assert bob_client.delete(f"/api/v1/profiles/{profile.id}/").status_code == 403
        response = bob_client.post(
            "/api/v1/shares/",
            {
                "profile": str(profile.id),
                "recipient_name": "Dr X",
                "scopes": ["MEDICATIONS"],
                "duration_hours": 1,
            },
            format="json",
        )
        assert response.status_code == 404

    def test_invalid_profile_id_returns_404(self, alice_client):
        assert alice_client.get("/api/v1/medications/?profile=not-a-uuid").status_code == 404
