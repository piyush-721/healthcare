"""Reusable DRF building blocks that enforce profile-level authorization.

Every health-data endpoint is built on :class:`ProfileScopedViewSet`, which:

* scopes **list** queries to one profile (``?profile=<uuid>``, defaulting to the
  caller's own profile) after checking the view permission;
* scopes **detail** queries to profiles the caller may view, so foreign objects
  return 404 (no IDOR, no existence disclosure);
* requires the manage permission for writes (403 if the caller can only view);
* takes the profile for **create** from the request and checks manage access;
* never lets a client move an object to another profile (``profile`` is read-only);
* records RECORD_CREATED / RECORD_UPDATED / RECORD_DELETED audit events.
"""

from __future__ import annotations

from typing import Any

from django.db import transaction
from django.db.models import Model, QuerySet
from rest_framework import permissions, serializers, viewsets
from rest_framework.exceptions import PermissionDenied

from apps.audit.models import AuditEvent
from apps.audit.services import record_event

from .access import ProfileAccess, accessible_profiles, get_profile_or_404, resolve_access
from .models import PatientProfile
from .services import get_self_profile


class ProfileRelatedField(serializers.PrimaryKeyRelatedField):
    """A FK that may only reference objects belonging to the same profile.

    Objects from other profiles are indistinguishable from non-existent ones.
    """

    def __init__(self, model: type[Model], profile_lookup: str = "profile", **kwargs: Any):
        self.model = model
        self.profile_lookup = profile_lookup
        kwargs.setdefault("queryset", model.objects.all())
        kwargs.setdefault("pk_field", serializers.UUIDField(format="hex_verbose"))
        super().__init__(**kwargs)

    def get_queryset(self) -> QuerySet:
        profile = self.context.get("profile")
        if profile is None:
            return self.model.objects.none()
        return self.model.objects.filter(**{self.profile_lookup: profile})

    def use_pk_only_optimization(self) -> bool:
        return True


class ProfileScopedSerializer(serializers.ModelSerializer):
    profile = serializers.UUIDField(source="profile_id", read_only=True)


class ProfileAccessMixin:
    """Helpers for resolving and checking profile access in any view."""

    request: Any

    def resolve_profile_access(self, perm: str | None, profile_id: Any = None) -> ProfileAccess:
        if profile_id is None:
            profile_id = self.request.query_params.get("profile")
        if not profile_id:
            access = resolve_access(self.request.user, get_self_profile(self.request.user))
            assert access is not None  # the owner always has access to their own profile
            return access
        return get_profile_or_404(self.request.user, profile_id, perm)


class ProfileScopedViewSet(ProfileAccessMixin, viewsets.ModelViewSet):
    view_permission: str
    manage_permission: str
    # ORM path from the model to its PatientProfile.
    profile_lookup: str = "profile"
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    _access: ProfileAccess | None = None
    _object_cache: Model | None = None

    # -- querysets -----------------------------------------------------------
    def base_queryset(self) -> QuerySet:
        return self.queryset.all()  # type: ignore[union-attr]

    def get_queryset(self) -> QuerySet:
        qs = self.base_queryset()
        if getattr(self, "swagger_fake_view", False):
            return qs.none()
        if self.action in ("list", "create") or self.detail is False:
            access = self.get_list_access()
            return qs.filter(**{self.profile_lookup: access.profile})
        viewable = accessible_profiles(self.request.user, self.view_permission)
        return qs.filter(**{f"{self.profile_lookup}__in": viewable})

    def get_list_access(self) -> ProfileAccess:
        if self._access is None:
            self._access = self.resolve_profile_access(self.view_permission)
        return self._access

    def profile_of(self, obj: Model) -> PatientProfile:
        target: Any = obj
        for part in self.profile_lookup.split("__"):
            target = getattr(target, part)
        return target

    # -- object-level checks -------------------------------------------------
    def check_object_permissions(self, request: Any, obj: Model) -> None:
        super().check_object_permissions(request, obj)
        if request.method not in permissions.SAFE_METHODS:
            access = resolve_access(request.user, self.profile_of(obj))
            if access is None or not access.can(self.manage_permission):
                raise PermissionDenied("You can view this item but not change it.")

    def get_serializer_context(self) -> dict[str, Any]:
        context = super().get_serializer_context()
        if getattr(self, "swagger_fake_view", False):
            return context
        if self.action == "create":
            context["profile"] = self.get_create_access().profile
        elif getattr(self, "_object_cache", None) is not None:
            context["profile"] = self.profile_of(self._object_cache)
        return context

    def get_object(self) -> Model:
        obj = super().get_object()
        self._object_cache = obj
        return obj

    def get_create_access(self) -> ProfileAccess:
        profile_id = self.request.data.get("profile") if hasattr(self.request, "data") else None
        if self._access is None or (profile_id and str(self._access.profile.id) != str(profile_id)):
            self._access = self.resolve_profile_access(self.manage_permission, profile_id or None)
        if not self._access.can(self.manage_permission):
            raise PermissionDenied("You do not have permission to add items to this profile.")
        return self._access

    # -- writes with auditing ------------------------------------------------
    def perform_create(self, serializer: serializers.BaseSerializer) -> None:
        access = self.get_create_access()
        with transaction.atomic():
            instance = serializer.save(**self.create_kwargs(access))
            self.audit(AuditEvent.RECORD_CREATED, instance)

    def create_kwargs(self, access: ProfileAccess) -> dict[str, Any]:
        return {"profile": access.profile}

    def perform_update(self, serializer: serializers.BaseSerializer) -> None:
        with transaction.atomic():
            instance = serializer.save()
            self.audit(
                AuditEvent.RECORD_UPDATED, instance, fields=sorted(serializer.validated_data.keys())
            )

    def perform_destroy(self, instance: Model) -> None:
        with transaction.atomic():
            self.audit(AuditEvent.RECORD_DELETED, instance)
            instance.delete()

    def audit(self, event: AuditEvent, instance: Model, **metadata: Any) -> None:
        record_event(
            event,
            request=self.request,
            target=instance,
            profile_id=self.profile_of(instance).id,
            metadata={"resource": instance.__class__.__name__, **metadata},
        )
