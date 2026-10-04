import pytest
from django.core import mail

from apps.audit.models import AuditEvent, AuditLog
from apps.family.models import CaregiverAccess
from apps.notifications.models import Notification
from apps.profiles.access import Perm

from .conftest import self_profile


@pytest.fixture
def invite(alice_client, alice, django_capture_on_commit_callbacks):
    def _invite(email="bob@example.com", permissions=(Perm.VIEW_MEDICATIONS,), profile=None):
        with django_capture_on_commit_callbacks(execute=True):
            return alice_client.post(
                "/api/v1/family/caregivers/",
                {
                    "profile": str(profile or self_profile(alice).id),
                    "email": email,
                    "relationship": "Son",
                    "permissions": list(permissions),
                },
                format="json",
            )

    return _invite


class TestDependents:
    def test_add_dependent_member(self, alice_client):
        response = alice_client.post(
            "/api/v1/family/",
            {
                "full_name": "Kid Patient",
                "relationship_to_owner": "CHILD",
                "date_of_birth": "2018-05-01",
            },
            format="json",
        )
        assert response.status_code == 201
        assert response.json()["access_role"] == "OWNER"
        overview = alice_client.get("/api/v1/family/").json()
        assert [d["full_name"] for d in overview["dependents"]] == ["Kid Patient"]

    def test_dependent_cannot_claim_self_relationship(self, alice_client):
        response = alice_client.post(
            "/api/v1/profiles/", {"full_name": "X", "relationship_to_owner": "SELF"}, format="json"
        )
        assert response.status_code == 400

    def test_guardian_manages_dependent_data(self, alice_client):
        child = alice_client.post(
            "/api/v1/family/", {"full_name": "Kid", "relationship_to_owner": "CHILD"}, format="json"
        ).json()
        response = alice_client.post(
            "/api/v1/medications/",
            {"profile": child["id"], "name": "Syrup", "dosage": "5 ml", "start_date": "2026-10-01"},
            format="json",
        )
        assert response.status_code == 201
        assert alice_client.get("/api/v1/medications/").json()["count"] == 0
        assert alice_client.get(f"/api/v1/medications/?profile={child['id']}").json()["count"] == 1

    def test_cannot_delete_self_profile(self, alice_client, alice):
        response = alice_client.delete(f"/api/v1/profiles/{self_profile(alice).id}/")
        assert response.status_code == 400


class TestCaregiverInvitations:
    def test_invite_accept_flow(self, invite, bob_client, bob, alice):
        response = invite(permissions=[Perm.MANAGE_MEDICATIONS])
        assert response.status_code == 201
        grant = response.json()
        assert grant["status"] == "PENDING"
        # MANAGE implies VIEW
        assert set(grant["permissions"]) == {Perm.VIEW_MEDICATIONS, Perm.MANAGE_MEDICATIONS}
        assert mail.outbox and mail.outbox[-1].to == ["bob@example.com"]
        assert Notification.objects.filter(user=bob, category="SHARING").exists()

        invitations = bob_client.get("/api/v1/family/invitations/").json()
        assert [i["id"] for i in invitations] == [grant["id"]]
        accepted = bob_client.post(f"/api/v1/family/invitations/{grant['id']}/accept/").json()
        assert accepted["status"] == "ACTIVE"
        profile = self_profile(alice)
        assert bob_client.get(f"/api/v1/medications/?profile={profile.id}").status_code == 200
        assert bob_client.get(f"/api/v1/appointments/?profile={profile.id}").status_code == 403
        assert AuditLog.objects.filter(event_type=AuditEvent.CAREGIVER_ACCEPTED).exists()

    def test_invitation_for_other_email_not_visible(self, invite, make_user, client_for):
        grant = invite().json()
        eve = client_for(make_user("eve@example.com"))
        assert eve.get("/api/v1/family/invitations/").json() == []
        response = eve.post(f"/api/v1/family/invitations/{grant['id']}/accept/")
        assert response.status_code == 404

    def test_unverified_user_cannot_accept(self, invite, make_user, client_for, db):
        grant = invite(email="unverified@example.com").json()
        user = make_user("unverified@example.com", verified=True)
        client = client_for(user)
        user.email_verified_at = None
        user.save()
        assert client.post(f"/api/v1/family/invitations/{grant['id']}/accept/").status_code == 404

    def test_decline(self, invite, bob_client):
        grant = invite().json()
        response = bob_client.post(f"/api/v1/family/invitations/{grant['id']}/decline/")
        assert response.json()["status"] == "DECLINED"

    def test_cannot_invite_self_or_duplicate(self, invite):
        assert invite(email="alice@example.com").status_code == 400
        assert invite().status_code == 201
        assert invite().json()["error"]["code"] == "INVITE_PENDING"

    def test_cannot_invite_for_profile_not_owned(self, invite, bob):
        assert invite(profile=self_profile(bob).id).status_code == 404

    def test_empty_permissions_rejected(self, invite):
        assert invite(permissions=[]).status_code == 400

    def test_update_permissions_and_revoke(self, invite, alice_client, bob_client, alice):
        grant = invite().json()
        bob_client.post(f"/api/v1/family/invitations/{grant['id']}/accept/")
        profile = self_profile(alice)
        response = alice_client.patch(
            f"/api/v1/family/caregivers/{grant['id']}/",
            {"permissions": [Perm.VIEW_APPOINTMENTS]},
            format="json",
        )
        assert response.json()["permissions"] == [Perm.VIEW_APPOINTMENTS]
        assert bob_client.get(f"/api/v1/medications/?profile={profile.id}").status_code == 403
        assert bob_client.get(f"/api/v1/appointments/?profile={profile.id}").status_code == 200
        alice_client.post(f"/api/v1/family/caregivers/{grant['id']}/revoke/")
        assert bob_client.get(f"/api/v1/appointments/?profile={profile.id}").status_code == 404
        assert AuditLog.objects.filter(event_type=AuditEvent.CAREGIVER_REVOKED).exists()

    def test_caregiver_can_leave(self, invite, bob_client):
        grant = invite().json()
        bob_client.post(f"/api/v1/family/invitations/{grant['id']}/accept/")
        assert bob_client.post(f"/api/v1/family/caring-for/{grant['id']}/leave/").status_code == 204
        assert CaregiverAccess.objects.get(id=grant["id"]).status == "REVOKED"

    def test_caregiver_cannot_manage_grants(self, invite, bob_client):
        grant = invite(permissions=list(Perm.values)).json()
        bob_client.post(f"/api/v1/family/invitations/{grant['id']}/accept/")
        response = bob_client.patch(
            f"/api/v1/family/caregivers/{grant['id']}/",
            {"permissions": [Perm.VIEW_PROFILE]},
            format="json",
        )
        assert response.status_code == 404
