# ADR-0005: Server state in RTK Query, minimal Redux slices

**Status:** Accepted

## Decision
All API data flows through RTK Query endpoints, with tag invalidation keeping lists, details, the
dashboard and the timeline consistent after mutations. Hand-written slices exist only for truly
global client state: `auth` (in-memory token and user), `profile` (whose data is being viewed) and
`toasts`. Form and dialog state stays local.

Endpoint argument and response types come from the OpenAPI schema via `openapi-typescript`, so the
contract is checked at compile time.

## Consequences
No server responses are duplicated into slices, and caching and refetch-on-focus come for free.
Resetting the API state on sign-out ensures no cached health data survives logout.
