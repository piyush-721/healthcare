from __future__ import annotations

import io
from collections.abc import Callable
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.profiles.models import PatientProfile
from apps.profiles.services import create_self_profile

PASSWORD = "Correct-Horse-Battery-9"

PDF_BYTES = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"
PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
EICAR = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"


@pytest.fixture(autouse=True)
def _clear_cache():
    from django.core.cache import cache

    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def api() -> APIClient:
    return APIClient()


@pytest.fixture
def make_user(db) -> Callable[..., User]:
    counter = {"n": 0}

    def _make(
        email: str | None = None,
        *,
        verified: bool = True,
        role: str = User.Role.USER,
        full_name: str | None = None,
        tz: str = "UTC",
    ) -> User:
        counter["n"] += 1
        email = email or f"user{counter['n']}@example.com"
        user = User.objects.create_user(
            email=email,
            password=PASSWORD,
            full_name=full_name or f"User {counter['n']}",
            role=role,
            timezone=tz,
            email_verified_at=timezone.now() if verified else None,
        )
        create_self_profile(user)
        return user

    return _make


def login(client: APIClient, user: User, password: str = PASSWORD) -> APIClient:
    response = client.post("/api/v1/auth/login/", {"email": user.email, "password": password})
    assert response.status_code == 200, response.content
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access_token']}")
    return client


@pytest.fixture
def client_for(make_user) -> Callable[[User], APIClient]:
    def _client(user: User) -> APIClient:
        return login(APIClient(), user)

    return _client


@pytest.fixture
def alice(make_user) -> User:
    return make_user("alice@example.com", full_name="Alice Patient")


@pytest.fixture
def bob(make_user) -> User:
    return make_user("bob@example.com", full_name="Bob Other")


@pytest.fixture
def alice_client(client_for, alice) -> APIClient:
    return client_for(alice)


@pytest.fixture
def bob_client(client_for, bob) -> APIClient:
    return client_for(bob)


def self_profile(user: User) -> PatientProfile:
    return PatientProfile.objects.get(owner=user, is_self=True)


def upload_file(name: str = "report.pdf", content: bytes = PDF_BYTES) -> io.BytesIO:
    buffer = io.BytesIO(content)
    buffer.name = name
    return buffer


def grant_caregiver(
    owner: User,
    caregiver: User,
    permissions: list[str],
    profile: PatientProfile | None = None,
    expires_at=None,
):  # type: ignore[no-untyped-def]
    from apps.family.models import CaregiverAccess
    from apps.profiles.access import normalize_permissions

    return CaregiverAccess.objects.create(
        profile=profile or self_profile(owner),
        granted_by=owner,
        caregiver=caregiver,
        invite_email=caregiver.email,
        permissions=normalize_permissions(permissions),
        status=CaregiverAccess.Status.ACTIVE,
        accepted_at=timezone.now(),
        invite_expires_at=timezone.now() + timedelta(days=7),
        expires_at=expires_at,
    )
