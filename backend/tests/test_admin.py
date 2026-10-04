import pytest

from apps.accounts.models import User
from apps.audit.models import AuditEvent, AuditLog


@pytest.fixture
def admin(make_user):
    return make_user("admin@example.com", role="ADMIN", full_name="Ada Admin")


@pytest.fixture
def admin_client(client_for, admin):
    return client_for(admin)


ADMIN_ENDPOINTS = [
    "/api/v1/admin/stats/",
    "/api/v1/admin/users/",
    "/api/v1/admin/audit-logs/",
    "/api/v1/admin/config/",
]


@pytest.mark.parametrize("url", ADMIN_ENDPOINTS)
def test_regular_users_cannot_access_admin(alice_client, url):
    assert alice_client.get(url).status_code == 403


@pytest.mark.parametrize("url", ADMIN_ENDPOINTS)
def test_admin_endpoints_available_to_admin(admin_client, url):
    assert admin_client.get(url).status_code == 200


def test_stats_contain_only_aggregates(admin_client, alice):
    stats = admin_client.get("/api/v1/admin/stats/").json()
    assert stats["users"]["total"] == 2
    assert "alice" not in str(stats).lower()


def test_user_search_and_detail(admin_client, alice):
    users = admin_client.get("/api/v1/admin/users/?search=alice").json()["results"]
    assert [u["email"] for u in users] == ["alice@example.com"]
    detail = admin_client.get(f"/api/v1/admin/users/{alice.id}/").json()
    assert set(detail) == {
        "id",
        "email",
        "full_name",
        "role",
        "status",
        "email_verified",
        "date_joined",
        "last_login",
        "status_changed_at",
        "timezone",
        "active_sessions",
    }


def test_suspend_revokes_sessions_and_reactivate(admin_client, alice_client, alice):
    response = admin_client.post(
        f"/api/v1/admin/users/{alice.id}/suspend/", {"reason": "Abuse report"}
    )
    assert response.json()["status"] == "SUSPENDED"
    assert alice_client.get("/api/v1/auth/me/").status_code == 401
    log = AuditLog.objects.get(event_type=AuditEvent.ACCOUNT_SUSPENDED)
    assert log.subject_user == alice and log.metadata["reason"] == "Abuse report"
    assert (
        admin_client.post(f"/api/v1/admin/users/{alice.id}/reactivate/").json()["status"]
        == "ACTIVE"
    )


def test_admin_cannot_suspend_or_demote_self(admin_client, admin):
    assert (
        admin_client.post(f"/api/v1/admin/users/{admin.id}/suspend/", {"reason": "x"}).status_code
        == 400
    )
    assert (
        admin_client.post(f"/api/v1/admin/users/{admin.id}/role/", {"role": "USER"}).status_code
        == 400
    )


def test_role_change_is_audited(admin_client, alice):
    response = admin_client.post(f"/api/v1/admin/users/{alice.id}/role/", {"role": "ADMIN"})
    assert response.json()["role"] == "ADMIN"
    log = AuditLog.objects.get(event_type=AuditEvent.ROLE_CHANGED)
    assert log.metadata == {"from": "USER", "to": "ADMIN"}


def test_audit_log_filtering(admin_client, alice):
    data = admin_client.get("/api/v1/admin/audit-logs/?event_type=LOGIN").json()
    assert data["count"] >= 1
    assert {row["event_type"] for row in data["results"]} == {"LOGIN"}
    types = admin_client.get("/api/v1/admin/audit-logs/event-types/").json()
    assert {"value": "LOGIN", "label": "Login"} in types


def test_admin_cannot_read_health_data_of_users(admin_client, alice_client, alice):
    med = alice_client.post(
        "/api/v1/medications/",
        {"name": "Secret", "dosage": "1", "start_date": "2026-10-01"},
        format="json",
    ).json()
    assert admin_client.get(f"/api/v1/medications/{med['id']}/").status_code == 404
    profile = alice.owned_profiles.get(is_self=True)
    assert admin_client.get(f"/api/v1/profiles/{profile.id}/").status_code == 404
    assert admin_client.get(f"/api/v1/timeline/?profile={profile.id}").status_code == 404


def test_audit_log_is_immutable(alice):
    from apps.audit.services import record_event

    entry = record_event(AuditEvent.LOGIN, actor=alice)
    entry.event_type = "LOGOUT"
    with pytest.raises(ValueError):
        entry.save()
    with pytest.raises(ValueError):
        entry.delete()


def test_suspended_admin_loses_admin_access(admin_client, admin):
    User.objects.filter(id=admin.id).update(status="SUSPENDED")
    assert admin_client.get("/api/v1/admin/stats/").status_code == 401
