import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { authenticatedState, makeProfile, mockApi, renderWithStore } from "@/test/utils";

import { InviteCaregiverDialog } from "./CaregiverDialogs";
import { describePermissions, togglePermission } from "./permissions";

describe("togglePermission", () => {
  it("grants view with manage, and removes manage with view", () => {
    expect(togglePermission([], "MANAGE_MEDICATIONS", true)).toEqual([
      "VIEW_MEDICATIONS",
      "MANAGE_MEDICATIONS",
    ]);
    expect(
      togglePermission(["VIEW_MEDICATIONS", "MANAGE_MEDICATIONS"], "VIEW_MEDICATIONS", false),
    ).toEqual([]);
    expect(
      togglePermission(["VIEW_MEDICATIONS", "MANAGE_MEDICATIONS"], "MANAGE_MEDICATIONS", false),
    ).toEqual(["VIEW_MEDICATIONS"]);
  });

  it("describes permissions without repeating implied view access", () => {
    expect(describePermissions(["VIEW_PROFILE", "MANAGE_PROFILE", "VIEW_LAB_RESULTS"])).toEqual([
      "Edit health profile",
      "View lab results",
    ]);
  });
});

describe("InviteCaregiverDialog", () => {
  it("checking a manage permission also checks (and locks) the view permission", async () => {
    const user = userEvent.setup();
    const calls = mockApi([
      { method: "POST", path: "/api/v1/family/caregivers/", status: 201, body: {} },
    ]);
    renderWithStore(<InviteCaregiverDialog open onClose={() => {}} profiles={[makeProfile()]} />, {
      preloadedState: authenticatedState(),
    });

    const view = screen.getByLabelText("View medications");
    const manage = screen.getByLabelText("Manage medications & log doses");
    expect(view).not.toBeChecked();
    expect(screen.queryByLabelText(/full access/i)).not.toBeInTheDocument();

    await user.click(manage);
    expect(manage).toBeChecked();
    expect(view).toBeChecked();
    expect(view).toBeDisabled();

    await user.click(manage);
    expect(manage).not.toBeChecked();
    expect(view).toBeChecked();
    expect(view).toBeEnabled();

    await user.click(screen.getByLabelText("Add records & upload documents"));
    await user.type(screen.getByLabelText(/Caregiver's email/), "bob@example.com");
    await user.click(screen.getByRole("button", { name: "Send invitation" }));

    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
    expect(calls.find((c) => c.method === "POST")?.body).toMatchObject({
      email: "bob@example.com",
      profile: makeProfile().id,
      permissions: ["VIEW_PROFILE", "VIEW_MEDICATIONS", "VIEW_DOCUMENTS", "UPLOAD_DOCUMENTS"],
      expires_at: null,
    });
  });

  it("requires a valid email and at least one permission", async () => {
    const user = userEvent.setup();
    const calls = mockApi([]);
    renderWithStore(<InviteCaregiverDialog open onClose={() => {}} profiles={[makeProfile()]} />, {
      preloadedState: authenticatedState(),
    });
    await user.click(screen.getByLabelText("View health profile"));
    await user.type(screen.getByLabelText(/Caregiver's email/), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Send invitation" }));
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Choose at least one permission.")).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });
});
