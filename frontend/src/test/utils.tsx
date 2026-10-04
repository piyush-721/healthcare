import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { Provider } from "react-redux";

import { makeStore, type RootState } from "@/store";
import type { PatientProfile, User } from "@/types/api";

export const testUser: User = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "alice@example.com",
  full_name: "Alice Patient",
  role: "USER",
  status: "ACTIVE",
  timezone: "UTC",
  email_verified: true,
  is_platform_admin: false,
  date_joined: "2026-01-01T00:00:00Z",
};

export function makeProfile(overrides: Partial<PatientProfile> = {}): PatientProfile {
  return {
    id: "22222222-2222-2222-2222-222222222222",
    is_self: true,
    relationship_to_owner: "SELF",
    full_name: "Alice Patient",
    owner_name: "Alice Patient",
    access_role: "OWNER",
    permissions: [
      "VIEW_PROFILE",
      "MANAGE_PROFILE",
      "VIEW_MEDICATIONS",
      "MANAGE_MEDICATIONS",
      "VIEW_APPOINTMENTS",
      "MANAGE_APPOINTMENTS",
      "VIEW_DOCUMENTS",
      "UPLOAD_DOCUMENTS",
      "VIEW_LAB_RESULTS",
      "MANAGE_LAB_RESULTS",
      "VIEW_TREATMENT_PLANS",
      "MANAGE_TREATMENT_PLANS",
    ],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as PatientProfile;
}

export function authenticatedState(user: User = testUser): Partial<RootState> {
  return {
    auth: { status: "authenticated", accessToken: "test-token", accessTokenExpiresAt: null, user },
  };
}

/** Render with a real Redux store (RTK Query included). Mock `fetch` to control API responses. */
export function renderWithStore(
  ui: ReactElement,
  {
    preloadedState,
    ...options
  }: { preloadedState?: Partial<RootState> } & Omit<RenderOptions, "wrapper"> = {},
) {
  const store = makeStore(preloadedState);
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  return { store, ...render(ui, { wrapper: Wrapper, ...options }) };
}

type Route = { method?: string; path: string | RegExp; status?: number; body: unknown };

/**
 * Minimal fetch mock: matches requests by method + path and returns JSON.
 * Unmatched requests fail loudly so tests never hit the network.
 */
export function mockApi(routes: Route[]) {
  const calls: { method: string; url: string; body: unknown }[] = [];
  const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request =
      input instanceof Request
        ? input
        : new Request(new URL(String(input), "http://localhost"), init);
    const url = new URL(request.url, "http://localhost");
    const method = request.method.toUpperCase();
    let body: unknown = undefined;
    try {
      body = await request.clone().json();
    } catch {
      body = undefined;
    }
    calls.push({ method, url: url.pathname + url.search, body });
    const route = routes.find(
      (r) =>
        (r.method ?? "GET").toUpperCase() === method &&
        (typeof r.path === "string" ? url.pathname === r.path : r.path.test(url.pathname)),
    );
    if (!route) {
      return new Response(
        JSON.stringify({ error: { code: "NOT_MOCKED", message: `${method} ${url.pathname}` } }),
        {
          status: 599,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    return new Response(JSON.stringify(route.body), {
      status: route.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  globalThis.fetch = fetchMock as typeof fetch;
  return calls;
}
