import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { mockApi, renderWithStore, testUser } from "@/test/utils";

import { LoginForm } from "./LoginForm";

async function submit(email = "alice@example.com", password = "Correct-Horse-1") {
  await userEvent.type(screen.getByLabelText(/email/i), email);
  await userEvent.type(screen.getByLabelText(/^password/i), password);
  await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
}

describe("LoginForm", () => {
  it("validates required fields before calling the API", async () => {
    const calls = mockApi([]);
    renderWithStore(<LoginForm />);
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText("Enter your email address.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it("stores the session in memory on success (never in localStorage)", async () => {
    mockApi([
      { path: "/api/v1/auth/csrf/", body: { csrf_token: "csrf" } },
      {
        method: "POST",
        path: "/api/v1/auth/login/",
        body: {
          access_token: "tok",
          access_token_expires_at: "2030-01-01T00:00:00Z",
          user: testUser,
        },
      },
    ]);
    const { store } = renderWithStore(<LoginForm />);
    await submit();
    await waitFor(() => expect(store.getState().auth.status).toBe("authenticated"));
    expect(store.getState().auth.accessToken).toBe("tok");
    expect(window.localStorage.length).toBe(0);
  });

  it("offers to resend verification for unverified accounts", async () => {
    mockApi([
      { path: "/api/v1/auth/csrf/", body: { csrf_token: "csrf" } },
      {
        method: "POST",
        path: "/api/v1/auth/login/",
        status: 403,
        body: {
          error: {
            code: "EMAIL_NOT_VERIFIED",
            message: "Please verify your email address before signing in.",
          },
        },
      },
    ]);
    renderWithStore(<LoginForm />);
    await submit();
    expect(await screen.findByText("Verify your email first")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /resend link/i })).toBeInTheDocument();
  });

  it("links deactivated accounts to reactivation", async () => {
    mockApi([
      { path: "/api/v1/auth/csrf/", body: { csrf_token: "csrf" } },
      {
        method: "POST",
        path: "/api/v1/auth/login/",
        status: 403,
        body: { error: { code: "ACCOUNT_DEACTIVATED", message: "Deactivated." } },
      },
    ]);
    renderWithStore(<LoginForm />);
    await submit();
    expect(
      await screen.findByRole("link", { name: /request a reactivation link/i }),
    ).toHaveAttribute("href", "/reactivate");
  });

  it("shows a generic message for bad credentials", async () => {
    mockApi([
      { path: "/api/v1/auth/csrf/", body: { csrf_token: "csrf" } },
      {
        method: "POST",
        path: "/api/v1/auth/login/",
        status: 401,
        body: { error: { code: "INVALID_CREDENTIALS", message: "Incorrect email or password." } },
      },
    ]);
    renderWithStore(<LoginForm />);
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password.");
  });
});
