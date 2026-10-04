from datetime import date, datetime

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.medications.services import profile_timezone
from apps.profiles.api import ProfileAccessMixin

from .services import TimelineQuery, build_timeline, parse_types


def _parse_date(value: str | None, name: str) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ValidationError({name: ["Use YYYY-MM-DD."]}) from exc


class TimelineView(ProfileAccessMixin, APIView):
    @extend_schema(
        tags=["timeline"],
        parameters=[
            OpenApiParameter("profile", str),
            OpenApiParameter("types", str, description="Comma-separated"),
            OpenApiParameter("from", date),
            OpenApiParameter("to", date),
            OpenApiParameter("q", str),
            OpenApiParameter("cursor", str),
            OpenApiParameter("limit", int),
        ],
        responses={200: dict},
    )
    def get(self, request: Request) -> Response:
        # Any relationship to the profile suffices; sources are filtered per permission.
        access = self.resolve_profile_access(perm=None)
        params = request.query_params
        start = _parse_date(params.get("from"), "from")
        end = _parse_date(params.get("to"), "to")
        if start and end and end < start:
            raise ValidationError({"to": ["End date must be after the start date."]})
        try:
            limit = min(max(int(params.get("limit", 30)), 1), 100)
        except ValueError as exc:
            raise ValidationError({"limit": ["Must be a number."]}) from exc
        before = None
        if params.get("cursor"):
            try:
                stamp, key = params["cursor"].split("|", 1)
                before = (datetime.fromisoformat(stamp), key)
            except ValueError as exc:
                raise ValidationError({"cursor": ["Invalid cursor."]}) from exc
        query = TimelineQuery(
            types=parse_types(params.get("types")),
            start=start,
            end=end,
            search=params.get("q", "").strip()[:100],
            before=before,
            limit=limit,
        )
        return Response(build_timeline(access, query, profile_timezone(access.profile)))
