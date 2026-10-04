from drf_spectacular.extensions import OpenApiAuthenticationExtension


class AccessTokenAuthenticationScheme(OpenApiAuthenticationExtension):
    target_class = "apps.accounts.authentication.AccessTokenAuthentication"
    name = "bearerAuth"

    def get_security_definition(self, auto_schema):  # type: ignore[no-untyped-def]
        return {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}
