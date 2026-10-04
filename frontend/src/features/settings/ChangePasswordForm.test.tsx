import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { authenticatedState, mockApi, renderWithStore } from "@/test/utils";

import { ChangePasswordForm, validatePasswordChange } from "./ChangePasswordForm";

describe("validatePasswordChange", () => {
  it("enforces length, difference and confirmation", () => {
    expect(validatePasswordChange({ current: "", next: "short", confirm: "other" })).toEqual({
      current_password: "Enter your current password.",
      new_password: "Use at least 10 characters.",
      confirm: "Passwords don't match.",
    });
    expect(
      validatePasswordChange({
        current: "same-password-1",
        next: "same-password-1",
        confirm: "same-password-1",
      }),
    ).toHaveProperty("new_password");
    expect(
      validatePasswordChange({
        current: "old-password",
        next: "brand-new-pass",
        confirm: "brand-new-pass",
      }),
    ).toEqual({});
  });
});

describe("ChangePasswordForm", () => {
  it("blocks submission when the confirmation doesn't match", async () => {
    const user = userEvent.setup();
    const calls = mockApi([]);
    renderWithStore(<ChangePasswordForm />, { preloadedState: authenticatedState() });
    await user.type(screen.getByLabelText(/Current password/), "old-password");
    await user.type(screen.getByLabelText(/^New password/), "brand-new-pass");
    await user.type(screen.getByLabelText(/Confirm new password/), "brand-new-pas");
    await user.click(screen.getByRole("button", { name: "Change password" }));
    expect(screen.getByText("Passwords don't match.")).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it("rejects passwords shorter than 10 characters", async () => {
    const user = userEvent.setup();
    mockApi([]);
    renderWithStore(<ChangePasswordForm />, { preloadedState: authenticatedState() });
    await user.type(screen.getByLabelText(/Current password/), "old-password");
    await user.type(screen.getByLabelText(/^New password/), "short1");
    await user.type(screen.getByLabelText(/Confirm new password/), "short1");
    await user.click(screen.getByRole("button", { name: "Change password" }));
    expect(screen.getByText("Use at least 10 characters.")).toBeInTheDocument();
  });

  it("submits valid input and maps server field errors", async () => {
    const user = userEvent.setup();
    const calls = mockApi([
      {
        method: "POST",
        path: "/api/v1/auth/password/change/",
        status: 400,
        body: {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid",
            fields: { current_password: ["Your current password is incorrect."] },
          },
        },
      },
    ]);
    renderWithStore(<ChangePasswordForm />, { preloadedState: authenticatedState() });
    await user.type(screen.getByLabelText(/Current password/), "wrong-password");
    await user.type(screen.getByLabelText(/^New password/), "brand-new-pass");
    await user.type(screen.getByLabelText(/Confirm new password/), "brand-new-pass");
    await user.click(screen.getByRole("button", { name: "Change password" }));
    expect(await screen.findByText("Your current password is incorrect.")).toBeInTheDocument();
    await waitFor(() =>
      expect(calls[0].body).toEqual({
        current_password: "wrong-password",
        new_password: "brand-new-pass",
      }),
    );
  });
});
