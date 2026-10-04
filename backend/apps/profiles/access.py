"""Central authorization rules for health data.

Every health-data API resolves access through this module. Rules:

* The profile **owner** (the person, or the guardian of a dependent profile)
  has every permission.
* A **caregiver** has exactly the permissions on their active, unexpired grant.
  ``MANAGE_*`` implies the matching ``VIEW_*``.
* **Platform admins** receive nothing from their role — admin status grants no
  health-data access at all.
* Healthcare providers never authenticate as users; they use consent-scoped
  share tokens handled by ``apps.sharing``.
"""

from __future__ import annotations

from dataclasses import dataclass

from django.db.models import Q, QuerySet, TextChoices
from django.utils import timezone

from .models import PatientProfile


class Perm(TextChoices):
    VIEW_PROFILE = "VIEW_PROFILE", "View health profile"
    MANAGE_PROFILE = "MANAGE_PROFILE", "Edit health profile"
    VIEW_MEDICATIONS = "VIEW_MEDICATIONS", "View medications"
    MANAGE_MEDICATIONS = "MANAGE_MEDICATIONS", "Manage medications & log doses"
    VIEW_APPOINTMENTS = "VIEW_APPOINTMENTS", "View appointments"
    MANAGE_APPOINTMENTS = "MANAGE_APPOINTMENTS", "Manage appointments"
    VIEW_DOCUMENTS = "VIEW_DOCUMENTS", "View records & documents"
    UPLOAD_DOCUMENTS = "UPLOAD_DOCUMENTS", "Add records & upload documents"
    VIEW_LAB_RESULTS = "VIEW_LAB_RESULTS", "View lab results"
    MANAGE_LAB_RESULTS = "MANAGE_LAB_RESULTS", "Manage lab results"
    VIEW_TREATMENT_PLANS = "VIEW_TREATMENT_PLANS", "View treatment plans"
    MANAGE_TREATMENT_PLANS = "MANAGE_TREATMENT_PLANS", "Manage treatment plans"


ALL_PERMISSIONS: frozenset[str] = frozenset(Perm.values)

IMPLIED: dict[str, str] = {
    Perm.MANAGE_PROFILE: Perm.VIEW_PROFILE,
    Perm.MANAGE_MEDICATIONS: Perm.VIEW_MEDICATIONS,
    Perm.MANAGE_APPOINTMENTS: Perm.VIEW_APPOINTMENTS,
    Perm.UPLOAD_DOCUMENTS: Perm.VIEW_DOCUMENTS,
    Perm.MANAGE_LAB_RESULTS: Perm.VIEW_LAB_RESULTS,
    Perm.MANAGE_TREATMENT_PLANS: Perm.VIEW_TREATMENT_PLANS,
}


def normalize_permissions(perms: list[str] | set[str]) -> list[str]:
    """Deduplicate, add implied view permissions and return a stable ordering."""
    result = {str(p) for p in perms}
    result |= {IMPLIED[p] for p in result if p in IMPLIED}
    return [p for p in Perm.values if p in result]


@dataclass(frozen=True)
class ProfileAccess:
    profile: PatientProfile
    role: str  # "OWNER" | "CAREGIVER"
    permissions: frozenset[str]

    def can(self, perm: str) -> bool:
        return perm in self.permissions


def active_grant_q(prefix: str = "") -> Q:
    now = timezone.now()
    return Q(**{f"{prefix}status": "ACTIVE"}) & (
        Q(**{f"{prefix}expires_at__isnull": True}) | Q(**{f"{prefix}expires_at__gt": now})
    )


def resolve_access(user, profile: PatientProfile) -> ProfileAccess | None:  # type: ignore[no-untyped-def]
    if user is None or not getattr(user, "is_authenticated", False) or not user.is_active:
        return None
    if profile.owner_id == user.id:
        return ProfileAccess(profile, "OWNER", ALL_PERMISSIONS)
    from apps.family.models import CaregiverAccess

    grant = (
        CaregiverAccess.objects.filter(profile=profile, caregiver=user)
        .filter(active_grant_q())
        .only("permissions")
        .first()
    )
    if grant is None:
        return None
    return ProfileAccess(profile, "CAREGIVER", frozenset(grant.permissions))


def accessible_profiles(user, perm: str | None = None) -> QuerySet[PatientProfile]:  # type: ignore[no-untyped-def]
    """Profiles the user may access (optionally requiring a specific permission)."""
    if user is None or not getattr(user, "is_authenticated", False) or not user.is_active:
        return PatientProfile.objects.none()
    grant_q = Q(caregiver_grants__caregiver=user) & active_grant_q("caregiver_grants__")
    if perm is not None:
        grant_q &= Q(caregiver_grants__permissions__contains=[perm])
    return PatientProfile.objects.filter(Q(owner=user) | grant_q).distinct()


def get_profile_or_404(user, profile_id, perm: str | None) -> ProfileAccess:  # type: ignore[no-untyped-def]
    """Return access for ``profile_id`` or raise 404/403.

    Profiles the user has no relationship with yield 404 so their existence is
    not disclosed. A known profile without the specific permission yields 403.
    ``perm=None`` accepts any relationship (callers then filter per permission).
    """
    from django.core.exceptions import ValidationError as DjangoValidationError
    from rest_framework.exceptions import NotFound, PermissionDenied

    try:
        profile = PatientProfile.objects.get(id=profile_id)
    except (PatientProfile.DoesNotExist, DjangoValidationError, ValueError) as exc:
        raise NotFound("Profile not found.") from exc
    access = resolve_access(user, profile)
    if access is None:
        raise NotFound("Profile not found.")
    if perm is not None and not access.can(perm):
        raise PermissionDenied("You do not have permission for this part of the profile.")
    return access
