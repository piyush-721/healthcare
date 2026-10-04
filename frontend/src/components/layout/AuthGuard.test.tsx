import { screen } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { describe, expect, it } from "vitest";

import { authenticatedState, renderWithStore, testUser } from "@/test/utils";

import { AuthGuard } from "./AuthGuard";

describe("AuthGuard", () => {
  it("redirects anonymous visitors to login", () => {
    renderWithStore(<AuthGuard>secret</AuthGuard>, {
      preloadedState: {
        auth: { status: "anonymous", accessToken: null, accessTokenExpiresAt: null, user: null },
      },
    });
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
    expect(useRouter().replace).toHaveBeenCalledWith("/login?next=%2F");
  });

  it("renders content for signed-in users", () => {
    renderWithStore(<AuthGuard>secret</AuthGuard>, { preloadedState: authenticatedState() });
    expect(screen.getByText("secret")).toBeInTheDocument();
  });

  it("blocks non-admins from the admin console", () => {
    renderWithStore(<AuthGuard requireAdmin>admin stuff</AuthGuard>, {
      preloadedState: authenticatedState(),
    });
    expect(screen.queryByText("admin stuff")).not.toBeInTheDocument();
    expect(screen.getByText("Administrator access required")).toBeInTheDocument();
  });

  it("allows platform admins into the admin console", () => {
    renderWithStore(<AuthGuard requireAdmin>admin stuff</AuthGuard>, {
      preloadedState: authenticatedState({ ...testUser, role: "ADMIN", is_platform_admin: true }),
    });
    expect(screen.getByText("admin stuff")).toBeInTheDocument();
  });
});
