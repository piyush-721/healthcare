import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { authenticatedState, mockApi, renderWithStore, testUser } from "@/test/utils";
import type { AdminUserDetail } from "@/types/api";

import { AdminUserDetailPage } from "./AdminUserDetailPage";

vi.mock("next/navigation", () => {
  const router = {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  };
  return {
    useRouter: () => router,
    usePathname: () => "/admin/users/u1",
    useSearchParams: () => new URLSearchParams(),
    useParams: () => ({ id: "u1" }),
  };
});

const member: AdminUserDetail = {
  id: "u1",
  email: "bob@example.com",
  full_name: "Bob Member",
  role: "USER",
  status: "ACTIVE",
  email_verified: true,
  date_joined: "2026-01-01T00:00:00Z",
  last_login: null,
  status_changed_at: null,
  timezone: "UTC",
  active_sessions: 2,
};

const admin = { ...testUser, role: "ADMIN" as const, is_platform_admin: true };
const empty = { count: 0, next: null, previous: null, results: [] };

describe("Admin suspend dialog", () => {
  it("requires a reason before calling the suspend endpoint", async () => {
    const calls = mockApi([
      { path: "/api/v1/admin/users/u1/", body: member },
      { path: "/api/v1/admin/users/u1/security-events/", body: empty },
      {
        method: "POST",
        path: "/api/v1/admin/users/u1/suspend/",
        body: { ...member, status: "SUSPENDED" },
      },
    ]);
    const user = userEvent.setup();
    renderWithStore(<AdminUserDetailPage />, { preloadedState: authenticatedState(admin) });

    await user.click(await screen.findByRole("button", { name: "Suspend" }));
    const submit = await screen.findByRole("button", { name: "Suspend account" });
    await user.click(submit);
    expect(
      await screen.findByText("Enter a reason. It is recorded in the audit log."),
    ).toBeInTheDocument();
    expect(calls.some((c) => c.url.endsWith("/suspend/"))).toBe(false);

    await user.type(screen.getByLabelText(/^Reason/), "Spam reports");
    await user.click(submit);
    await waitFor(() =>
      expect(calls.find((c) => c.url.endsWith("/suspend/"))?.body).toEqual({
        reason: "Spam reports",
      }),
    );
  });

  it("shows the backend error when suspending fails (e.g. own account)", async () => {
    mockApi([
      { path: "/api/v1/admin/users/u1/", body: member },
      { path: "/api/v1/admin/users/u1/security-events/", body: empty },
      {
        method: "POST",
        path: "/api/v1/admin/users/u1/suspend/",
        status: 400,
        body: {
          error: { code: "INVALID_OPERATION", message: "You can't suspend your own account." },
        },
      },
    ]);
    const user = userEvent.setup();
    const { store } = renderWithStore(<AdminUserDetailPage />, {
      preloadedState: authenticatedState(admin),
    });
    await user.click(await screen.findByRole("button", { name: "Suspend" }));
    await user.type(await screen.findByLabelText(/^Reason/), "Test");
    await user.click(screen.getByRole("button", { name: "Suspend account" }));
    await waitFor(() =>
      expect(JSON.stringify(store.getState())).toContain("You can't suspend your own account."),
    );
  });

  it("explains that the admin role grants no health-data access", async () => {
    mockApi([
      { path: "/api/v1/admin/users/u1/", body: member },
      { path: "/api/v1/admin/users/u1/security-events/", body: empty },
    ]);
    const user = userEvent.setup();
    renderWithStore(<AdminUserDetailPage />, { preloadedState: authenticatedState(admin) });
    await user.click(await screen.findByRole("button", { name: "Make admin" }));
    expect(
      await screen.findByText(/grants no access to anyone.s health information/),
    ).toBeInTheDocument();
  });
});
