import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";

import { sessionEstablished, signedOut } from "@/store/slices/authSlice";
import type { AuthResponse } from "@/types/api";

import { getCsrfToken } from "./csrf";

type StateWithAuth = { auth: { accessToken: string | null } };

const rawBaseQuery = fetchBaseQuery({
  baseUrl: "/api/v1",
  credentials: "same-origin",
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as StateWithAuth).auth.accessToken;
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return headers;
  },
});

let refreshInFlight: Promise<AuthResponse | null> | null = null;

/**
 * Exchange the HttpOnly refresh cookie for a new access token.
 * Concurrent callers share one request so the token rotates exactly once.
 */
export function refreshAccessToken(): Promise<AuthResponse | null> {
  refreshInFlight ??= (async () => {
    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const response = await fetch("/api/v1/auth/refresh/", {
          method: "POST",
          credentials: "same-origin",
          headers: { "X-CSRFToken": await getCsrfToken() },
        });
        if (response.ok) return (await response.json()) as AuthResponse;
        // 409: another tab rotated the cookie a moment ago — retry with the new cookie.
        // 429: rate limited — transient, so wait (briefly) instead of signing the user out.
        if (response.status === 409) {
          await new Promise((resolve) => setTimeout(resolve, 400));
        } else if (response.status === 429) {
          const retryAfter = Number(response.headers.get("Retry-After") ?? "2");
          await new Promise((resolve) =>
            setTimeout(resolve, Math.min(Math.max(retryAfter, 1), 5) * 1000),
          );
        } else {
          return null;
        }
      }
      return null;
    } catch {
      return null;
    } finally {
      setTimeout(() => {
        refreshInFlight = null;
      }, 0);
    }
  })();
  return refreshInFlight;
}

const NO_REAUTH = ["/auth/login/", "/auth/refresh/", "/auth/logout/", "/auth/register/"];

const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  apiContext,
  extraOptions,
) => {
  let result = await rawBaseQuery(args, apiContext, extraOptions);
  const url = typeof args === "string" ? args : args.url;
  if (result.error?.status === 401 && !NO_REAUTH.some((path) => url.startsWith(path))) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      apiContext.dispatch(sessionEstablished(refreshed));
      result = await rawBaseQuery(args, apiContext, extraOptions);
    } else {
      apiContext.dispatch(signedOut());
    }
  }
  return result;
};

export const TAG_TYPES = [
  "Me",
  "Sessions",
  "SecurityActivity",
  "Profiles",
  "HealthInfo",
  "Providers",
  "Records",
  "Documents",
  "Medications",
  "Doses",
  "Appointments",
  "Labs",
  "Treatments",
  "Family",
  "Shares",
  "Notifications",
  "Timeline",
  "Dashboard",
  "AdminUsers",
  "AdminAudit",
] as const;

export const api = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  tagTypes: TAG_TYPES,
  refetchOnFocus: true,
  refetchOnReconnect: true,
  endpoints: () => ({}),
});

/** Drop undefined/empty values so they don't become `?x=undefined`. */
export function cleanParams<T extends Record<string, unknown>>(params: T): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    out[key] = String(value);
  }
  return out;
}
