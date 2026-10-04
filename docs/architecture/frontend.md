# Frontend architecture

Next.js 16 (App Router) + React 19 + TypeScript (strict) + Redux Toolkit / RTK Query + Tailwind
CSS 4. Project root: `frontend/`.

## Routing

```text
src/app/
├── page.tsx                 landing (server component)
├── (auth)/                  login, signup, verify-email, forgot-password, reset-password, reactivate
├── (app)/                   authenticated area — AuthGuard + AppShell
│   ├── dashboard, timeline, health-profile, profile
│   ├── records (+ [id], documents/[id]), medications (+ [id]), appointments (+ [id])
│   ├── labs (+ [id]), treatments (+ [id])
│   ├── family (+ [id], invitations), sharing (+ [id]), notifications
│   └── settings (security, notifications)
├── admin/                   admin console — AuthGuard requireAdmin + AdminShell
└── shared/                  public, token-authorized provider view
```

Pages are thin. Most render a client component from `src/features/<feature>/`, and server
`page.tsx` files export `metadata`. Interactive pages are client components because they rely on
the in-memory access token. Server components are used where no session is needed, such as the
landing page.

## State management

| Kind of state | Where it lives |
| --- | --- |
| Server data (lists, details, mutations) | **RTK Query** cache (`src/services/*`), tag-based invalidation |
| Session (access token, user, status) | `authSlice` — memory only |
| Active profile (whose data you're viewing) | `profileSlice` |
| Toasts | `toastSlice` |
| Form inputs, dialogs, tabs, filters | local component state |

RTK Query endpoints are defined in one place per domain and typed from the generated OpenAPI
types (`src/types/openapi.d.ts`, regenerated with `npm run gen:api`). See
[ADR-0005](../decisions/0005-server-state-in-rtk-query.md).

## Session handling

- `SessionBootstrap` calls `POST /auth/refresh/` once on load. The HttpOnly cookie restores the
  session without any token in storage.
- A timer refreshes the access token 60 s before expiry.
- The base query retries once after a 401 by refreshing (a single shared in-flight promise). It
  handles `409 REFRESH_CONFLICT` from parallel tabs, and signs out when refresh fails.
- CSRF: the `csrftoken` cookie is read and sent as `X-CSRFToken` on login, refresh and logout.

## Profile context and permissions

`useActiveProfile()` returns the active profile, the caller's permissions on it, and a `can(perm)`
helper. Lists and creates pass `profile=<id>`. The UI hides controls the user can't use, but the
API enforces every rule independently.

## Design system (`src/components/ui`)

Button/LinkButton, Field + Input/Select/Textarea/Checkbox, Card/DetailList, Badge (always
text-labelled), Alert, Dialog/ConfirmDialog (native `<dialog>`: focus trap, Escape, inert
background), Tabs (ARIA, arrow keys), Table, Pagination, EmptyState/LoadingState/ErrorState, and
`QueryState`. `QueryState` renders loading, error (including the 403/404 variants), empty and
success states the same way on every screen.

Tokens (brand teal scale, canvas, card radius and shadow) are defined with `@theme` in
`src/app/globals.css`. They were chosen for WCAG AA contrast.

## Responsive layout

- **Desktop:** fixed sidebar with a profile switcher, plus a top bar with notifications and the
  account menu.
- **Mobile:** a compact top bar, a bottom tab bar (Home, Meds, Visits, Records, More) and a
  slide-in drawer for everything else. Tables become card lists on small screens.

## Testing

- **Vitest + Testing Library** (`npm test`): `renderWithStore()` uses a real Redux store and
  `mockApi()` stubs `fetch`. Tests cover forms, permission-dependent UI, error states and critical
  flows.
- **Playwright** (`npm run test:e2e`): a browser journey against the running stack.

## Security headers

`next.config.ts` sets CSP (`default-src 'self'`, `frame-ancestors 'none'`, …),
`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy`.
