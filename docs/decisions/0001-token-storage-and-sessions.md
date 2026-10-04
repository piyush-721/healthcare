# ADR-0001: Token storage and session rotation

**Status:** Accepted

## Context
The plan requires short-lived access tokens, an HttpOnly refresh cookie, rotation, revocation and
CSRF protection, with no tokens in `localStorage`.

## Decision
- The access token (JWT, 10 min) is returned in the JSON body and held only in Redux memory.
- The refresh token is an opaque random value in an `HttpOnly; Secure; SameSite=Strict` cookie
  scoped to `/api/v1/auth/`, with only an HMAC stored server-side in `AuthSession`.
- Every refresh rotates the token. The previous hash is kept, so reuse can be detected (theft
  leads to revocation). A 30 s grace period returns `409` instead of revoking, which absorbs
  multi-tab races.
- Each API request validates the session row, which makes logout, suspension and password changes
  take effect immediately.
- The cookie endpoints (login, refresh, logout) enforce a double-submit CSRF check, because DRF
  views are otherwise CSRF-exempt.

## Consequences
- One indexed lookup per request (session by primary key, joined to user). This is acceptable,
  and it buys instant revocation.
- Page reloads cost one refresh call (cookie → new access token).
- Server-rendered pages can't fetch user data with the in-memory token, so authenticated pages are
  client components.
