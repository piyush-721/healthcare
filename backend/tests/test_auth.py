import re
from datetime import timedelta

import pytest
from django.conf import settings
from django.core import mail
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import AuthSession, User
from apps.audit.models import AuditEvent, AuditLog

from .conftest import PASSWORD, login

REFRESH_COOKIE = settings.AUTH_REFRESH_COOKIE_NAME


def _token_from_last_email() -> str:
    match = re.search(r"#token=([\w\-]+)", mail.outbox[-1].body)
    assert match, mail.outbox[-1].body
    return match.group(1)


@pytest.fixture
def register(api, db, django_capture_on_commit_callbacks):
    def _register(email="new@example.com", password=PASSWORD, full_name="New Person"):
        with django_capture_on_commit_callbacks(execute=True):
            return api.post(
                "/api/v1/auth/register/",
                {
                    "email": email,
                    "password": password,
                    "full_name": full_name,
                    "timezone": "Asia/Kolkata",
                },
            )

    return _register


class TestRegistration:
    def test_register_creates_unverified_user_profile_and_sends_email(self, register):
        response = register()
        assert response.status_code == 201
        user = User.objects.get(email="new@example.com")
        assert not user.is_email_verified
        assert user.timezone == "Asia/Kolkata"
        assert user.owned_profiles.filter(is_self=True).exists()
        assert len(mail.outbox) == 1
        assert "verify-email#token=" in mail.outbox[0].body
        assert AuditLog.objects.filter(event_type=AuditEvent.SIGNUP, actor=user).exists()

    def test_password_is_hashed_never_stored_plain(self, register):
        register()
        user = User.objects.get(email="new@example.com")
        assert user.password != PASSWORD
        assert user.password.startswith(("md5$", "pbkdf2"))

    def test_duplicate_email_gives_identical_response(self, register, make_user):
        make_user("taken@example.com")
        response = register(email="TAKEN@example.com")
        assert response.status_code == 201
        assert User.objects.filter(email__iexact="taken@example.com").count() == 1
        assert "already have an account" in mail.outbox[-1].body

    def test_weak_password_rejected(self, register):
        response = register(password="password")
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "VALIDATION_ERROR"
        assert "password" in response.json()["error"]["fields"]

    def test_invalid_timezone_rejected(self, api, db):
        response = api.post(
            "/api/v1/auth/register/",
            {
                "email": "x@example.com",
                "password": PASSWORD,
                "full_name": "X",
                "timezone": "Mars/Base",
            },
        )
        assert response.status_code == 400


class TestEmailVerification:
    def test_verify_then_login(self, api, register):
        register()
        token = _token_from_last_email()
        response = api.post("/api/v1/auth/verify-email/", {"token": token})
        assert response.status_code == 200
        assert User.objects.get(email="new@example.com").is_email_verified
        # Token is single-use
        assert api.post("/api/v1/auth/verify-email/", {"token": token}).status_code == 400

    def test_login_blocked_until_verified(self, api, register):
        register()
        response = api.post(
            "/api/v1/auth/login/", {"email": "new@example.com", "password": PASSWORD}
        )
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "EMAIL_NOT_VERIFIED"

    def test_expired_token_rejected(self, api, register):
        register()
        token = _token_from_last_email()
        User.objects.get(email="new@example.com").account_tokens.update(
            expires_at=timezone.now() - timedelta(minutes=1)
        )
        response = api.post("/api/v1/auth/verify-email/", {"token": token})
        assert response.json()["error"]["code"] == "INVALID_TOKEN"

    def test_resend_invalidates_previous_token(
        self, api, register, django_capture_on_commit_callbacks
    ):
        register()
        first = _token_from_last_email()
        with django_capture_on_commit_callbacks(execute=True):
            assert (
                api.post(
                    "/api/v1/auth/verify-email/resend/", {"email": "new@example.com"}
                ).status_code
                == 202
            )
        second = _token_from_last_email()
        assert first != second
        assert api.post("/api/v1/auth/verify-email/", {"token": first}).status_code == 400
        assert api.post("/api/v1/auth/verify-email/", {"token": second}).status_code == 200


class TestLoginAndSessions:
    def test_login_sets_httponly_strict_refresh_cookie(self, api, alice):
        response = api.post(
            "/api/v1/auth/login/", {"email": "alice@example.com", "password": PASSWORD}
        )
        assert response.status_code == 200
        body = response.json()
        assert body["access_token"]
        assert body["user"]["email"] == "alice@example.com"
        assert "refresh" not in str(body).lower().replace("refresh_", "")
        cookie = response.cookies[REFRESH_COOKIE]
        assert cookie["httponly"]
        assert cookie["samesite"] == "Strict"
        assert cookie["path"] == "/api/v1/auth/"
        assert cookie["secure"]
        assert AuditLog.objects.filter(event_type=AuditEvent.LOGIN, actor=alice).exists()

    def test_login_is_case_insensitive_on_email(self, api, alice):
        response = api.post(
            "/api/v1/auth/login/", {"email": "ALICE@Example.com", "password": PASSWORD}
        )
        assert response.status_code == 200

    def test_wrong_password_is_generic_and_audited(self, api, alice):
        response = api.post(
            "/api/v1/auth/login/", {"email": "alice@example.com", "password": "nope"}
        )
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "INVALID_CREDENTIALS"
        unknown = api.post(
            "/api/v1/auth/login/", {"email": "ghost@example.com", "password": "nope"}
        )
        assert unknown.json() == response.json()
        assert AuditLog.objects.filter(
            event_type=AuditEvent.LOGIN_FAILED, subject_user=alice
        ).exists()

    def test_refresh_rotates_token(self, api, alice):
        api.post("/api/v1/auth/login/", {"email": "alice@example.com", "password": PASSWORD})
        old = api.cookies[REFRESH_COOKIE].value
        response = api.post("/api/v1/auth/refresh/")
        assert response.status_code == 200
        new = response.cookies[REFRESH_COOKIE].value
        assert new != old
        assert response.json()["access_token"]

    def test_reused_refresh_token_revokes_session(self, api, alice):
        api.post("/api/v1/auth/login/", {"email": "alice@example.com", "password": PASSWORD})
        stolen = api.cookies[REFRESH_COOKIE].value
        api.post("/api/v1/auth/refresh/")
        AuthSession.objects.update(rotated_at=timezone.now() - timedelta(minutes=5))
        attacker = APIClient()
        attacker.cookies[REFRESH_COOKIE] = stolen
        assert attacker.post("/api/v1/auth/refresh/").status_code == 401
        session = AuthSession.objects.get(user=alice)
        assert session.revoked_at is not None
        assert session.revoke_reason == "token_reuse"
        # Legitimate holder is also logged out
        assert api.post("/api/v1/auth/refresh/").status_code == 401
        assert AuditLog.objects.filter(event_type=AuditEvent.REFRESH_TOKEN_REUSE).exists()

    def test_concurrent_refresh_within_grace_does_not_revoke(self, api, alice):
        api.post("/api/v1/auth/login/", {"email": "alice@example.com", "password": PASSWORD})
        old = api.cookies[REFRESH_COOKIE].value
        api.post("/api/v1/auth/refresh/")
        other_tab = APIClient()
        other_tab.cookies[REFRESH_COOKIE] = old
        response = other_tab.post("/api/v1/auth/refresh/")
        assert response.status_code == 409
        assert AuthSession.objects.get(user=alice).revoked_at is None

    def test_refresh_without_cookie_fails(self, api, db):
        response = api.post("/api/v1/auth/refresh/")
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "SESSION_EXPIRED"

    def test_logout_revokes_session_and_access_token(self, api, alice):
        login(api, alice)
        assert api.get("/api/v1/auth/me/").status_code == 200
        response = api.post("/api/v1/auth/logout/")
        assert response.status_code == 204
        assert api.get("/api/v1/auth/me/").status_code == 401
        assert api.post("/api/v1/auth/refresh/").status_code == 401

    def test_logout_all_revokes_every_session(self, client_for, alice):
        first, second = client_for(alice), client_for(alice)
        assert first.post("/api/v1/auth/logout-all/").status_code == 204
        assert second.get("/api/v1/auth/me/").status_code == 401

    def test_expired_access_token_rejected(self, api, alice):
        from apps.accounts.tokens import issue_access_token

        login(api, alice)
        session = AuthSession.objects.get(user=alice)
        with override_settings(AUTH_ACCESS_TOKEN_LIFETIME=timedelta(seconds=-1)):
            token = issue_access_token(user_id=alice.id, session_id=session.id).token
        api.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        assert api.get("/api/v1/auth/me/").status_code == 401

    def test_tampered_access_token_rejected(self, api, alice):
        login(api, alice)
        token = api._credentials["HTTP_AUTHORIZATION"].split()[1]
        api.credentials(HTTP_AUTHORIZATION=f"Bearer {token[:-2]}xx")
        assert api.get("/api/v1/auth/me/").status_code == 401

    def test_csrf_enforced_on_cookie_endpoints(self, alice):
        strict = APIClient(enforce_csrf_checks=True)
        response = strict.post(
            "/api/v1/auth/login/", {"email": "alice@example.com", "password": PASSWORD}
        )
        assert response.status_code == 403
        csrf = strict.get("/api/v1/auth/csrf/").json()["csrf_token"]
        response = strict.post(
            "/api/v1/auth/login/",
            {"email": "alice@example.com", "password": PASSWORD},
            HTTP_X_CSRFTOKEN=csrf,
        )
        assert response.status_code == 200

    def test_sessions_list_and_revoke(self, client_for, alice):
        first, second = client_for(alice), client_for(alice)
        sessions = first.get("/api/v1/auth/sessions/").json()
        assert len(sessions) == 2
        assert sum(s["current"] for s in sessions) == 1
        other = next(s for s in sessions if not s["current"])
        assert first.delete(f"/api/v1/auth/sessions/{other['id']}/").status_code == 204
        assert second.get("/api/v1/auth/me/").status_code == 401

    def test_cannot_revoke_another_users_session(self, alice_client, bob_client, bob):
        bob_session = AuthSession.objects.filter(user=bob).first()
        response = alice_client.delete(f"/api/v1/auth/sessions/{bob_session.id}/")
        assert response.status_code == 404


class TestPasswords:
    def test_forgot_password_does_not_reveal_accounts(
        self, api, alice, django_capture_on_commit_callbacks
    ):
        with django_capture_on_commit_callbacks(execute=True):
            known = api.post("/api/v1/auth/password/forgot/", {"email": "alice@example.com"})
            unknown = api.post("/api/v1/auth/password/forgot/", {"email": "nobody@example.com"})
        assert known.status_code == unknown.status_code == 202
        assert known.json() == unknown.json()
        assert len(mail.outbox) == 1

    def test_reset_password_revokes_sessions(
        self, api, client_for, alice, django_capture_on_commit_callbacks
    ):
        existing = client_for(alice)
        with django_capture_on_commit_callbacks(execute=True):
            api.post("/api/v1/auth/password/forgot/", {"email": "alice@example.com"})
        token = _token_from_last_email()
        with django_capture_on_commit_callbacks(execute=True):
            response = api.post(
                "/api/v1/auth/password/reset/", {"token": token, "password": "Brand-New-Secret-77"}
            )
        assert response.status_code == 200
        assert existing.get("/api/v1/auth/me/").status_code == 401
        assert (
            api.post(
                "/api/v1/auth/login/",
                {"email": "alice@example.com", "password": "Brand-New-Secret-77"},
            ).status_code
            == 200
        )
        assert AuditLog.objects.filter(event_type=AuditEvent.PASSWORD_RESET).exists()
        # Reset token cannot be reused.
        again = api.post(
            "/api/v1/auth/password/reset/", {"token": token, "password": "Another-Secret-88"}
        )
        assert again.status_code == 400

    def test_change_password_keeps_current_session_only(self, client_for, alice):
        current, other = client_for(alice), client_for(alice)
        response = current.post(
            "/api/v1/auth/password/change/",
            {"current_password": PASSWORD, "new_password": "Changed-Secret-55"},
        )
        assert response.status_code == 200
        assert current.get("/api/v1/auth/me/").status_code == 200
        assert other.get("/api/v1/auth/me/").status_code == 401
        assert AuditLog.objects.filter(event_type=AuditEvent.PASSWORD_CHANGED, actor=alice).exists()

    def test_change_password_requires_current(self, alice_client):
        response = alice_client.post(
            "/api/v1/auth/password/change/",
            {"current_password": "wrong", "new_password": "Changed-Secret-55"},
        )
        assert response.status_code == 400
        assert "current_password" in response.json()["error"]["fields"]


class TestAccountStatus:
    def test_deactivate_and_reactivate(
        self, api, alice_client, alice, django_capture_on_commit_callbacks
    ):
        response = alice_client.post("/api/v1/auth/account/deactivate/", {"password": PASSWORD})
        assert response.status_code == 204
        alice.refresh_from_db()
        assert alice.status == User.Status.DEACTIVATED
        assert alice_client.get("/api/v1/auth/me/").status_code == 401
        login_attempt = api.post(
            "/api/v1/auth/login/", {"email": "alice@example.com", "password": PASSWORD}
        )
        assert login_attempt.json()["error"]["code"] == "ACCOUNT_DEACTIVATED"

        with django_capture_on_commit_callbacks(execute=True):
            api.post("/api/v1/auth/account/reactivate/request/", {"email": "alice@example.com"})
        token = _token_from_last_email()
        assert (
            api.post("/api/v1/auth/account/reactivate/confirm/", {"token": token}).status_code
            == 200
        )
        assert (
            api.post(
                "/api/v1/auth/login/", {"email": "alice@example.com", "password": PASSWORD}
            ).status_code
            == 200
        )

    def test_deactivation_revokes_outgoing_shares(self, alice_client, alice):
        share = alice_client.post(
            "/api/v1/shares/",
            {
                "recipient_name": "Dr. Sharma",
                "scopes": ["MEDICATIONS"],
                "duration_hours": 24,
            },
        ).json()
        alice_client.post("/api/v1/auth/account/deactivate/", {"password": PASSWORD})
        response = APIClient().get("/api/v1/shared/", HTTP_X_SHARE_TOKEN=share["access_token"])
        assert response.status_code == 403

    def test_suspended_user_cannot_login_or_self_reactivate(
        self, api, alice, django_capture_on_commit_callbacks
    ):
        alice.set_status(User.Status.SUSPENDED)
        alice.save()
        response = api.post(
            "/api/v1/auth/login/", {"email": "alice@example.com", "password": PASSWORD}
        )
        assert response.json()["error"]["code"] == "ACCOUNT_SUSPENDED"
        with django_capture_on_commit_callbacks(execute=True):
            api.post("/api/v1/auth/account/reactivate/request/", {"email": "alice@example.com"})
        assert len(mail.outbox) == 0


class TestMe:
    def test_update_profile_fields(self, alice_client):
        response = alice_client.patch("/api/v1/auth/me/", {"full_name": "Alice P."})
        assert response.status_code == 200
        assert response.json()["full_name"] == "Alice P."

    def test_mass_assignment_of_role_and_status_ignored(self, alice_client, alice):
        alice_client.patch(
            "/api/v1/auth/me/",
            {"role": "ADMIN", "status": "SUSPENDED", "email": "evil@example.com"},
        )
        alice.refresh_from_db()
        assert alice.role == User.Role.USER
        assert alice.status == User.Status.ACTIVE
        assert alice.email == "alice@example.com"

    def test_security_activity_shows_only_own_events(self, alice_client, bob_client):
        events = alice_client.get("/api/v1/auth/security-activity/").json()["results"]
        assert events
        assert all(e["event_type"] in {"LOGIN", "SIGNUP"} for e in events)
        assert "password" not in str(events).lower()


class TestRateLimiting:
    def test_login_is_rate_limited(self, api, alice):
        rates = {**settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"], "auth_login": "3/min"}
        with override_settings(
            REST_FRAMEWORK={**settings.REST_FRAMEWORK, "DEFAULT_THROTTLE_RATES": rates}
        ):
            from rest_framework.throttling import SimpleRateThrottle

            original = SimpleRateThrottle.THROTTLE_RATES
            SimpleRateThrottle.THROTTLE_RATES = rates
            try:
                codes = [
                    api.post(
                        "/api/v1/auth/login/", {"email": "alice@example.com", "password": "x"}
                    ).status_code
                    for _ in range(5)
                ]
            finally:
                SimpleRateThrottle.THROTTLE_RATES = original
        assert codes[:3] == [401, 401, 401]
        assert codes[3] == 429
