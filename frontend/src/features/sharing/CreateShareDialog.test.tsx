import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { authenticatedState, makeProfile, mockApi, renderWithStore } from "@/test/utils";

import { CreateShareDialog } from "./CreateShareDialog";

const created = {
  id: "s1",
  profile: "22222222-2222-2222-2222-222222222222",
  profile_name: "Alice Patient",
  recipient_name: "Dr. Mehta",
  recipient_email: "",
  purpose: "",
  scopes: ["PROFILE", "LAB_RESULTS", "FINANCIAL"],
  expires_at: "2026-10-07T10:00:00Z",
  revoked_at: null,
  revoked_by_name: "",
  state: "ACTIVE",
  access_count: 0,
  last_accessed_at: null,
  created_at: "2026-10-04T10:00:00Z",
  access_token: "secret-token",
  share_url: "http://localhost:3000/shared#token=secret-token",
};

describe("CreateShareDialog", () => {
  it("submits the selected scopes and shows the link once with a copy button", async () => {
    const user = userEvent.setup();
    const calls = mockApi([
      { method: "POST", path: "/api/v1/shares/", status: 201, body: created },
    ]);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    renderWithStore(<CreateShareDialog open onClose={() => {}} profiles={[makeProfile()]} />, {
      preloadedState: authenticatedState(),
    });

    // Bills are opt-in; everything else is pre-selected.
    expect(screen.getByLabelText("Medical bills")).not.toBeChecked();
    expect(screen.getByLabelText("Medications")).toBeChecked();

    await user.type(screen.getByLabelText(/Recipient name/), "Dr. Mehta");
    await user.click(screen.getByLabelText("Medications"));
    await user.click(screen.getByLabelText("Appointments"));
    await user.click(screen.getByLabelText("Records & documents"));
    await user.click(screen.getByLabelText("Treatment plans"));
    await user.click(screen.getByLabelText("Medical bills"));
    await user.selectOptions(screen.getByLabelText(/Link expires after/), "168");
    await user.click(screen.getByRole("button", { name: "Create share link" }));

    expect(await screen.findByText(/won't be shown again/)).toBeInTheDocument();
    const post = calls.find((c) => c.method === "POST");
    expect(post?.body).toMatchObject({
      recipient_name: "Dr. Mehta",
      scopes: ["PROFILE", "LAB_RESULTS", "FINANCIAL"],
      duration_hours: 168,
      send_email: false,
    });
    expect(screen.getByDisplayValue(created.share_url)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Copy link" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(created.share_url));
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
  });

  it("requires at least one scope and an email when emailing the link", async () => {
    const user = userEvent.setup();
    const calls = mockApi([]);
    renderWithStore(<CreateShareDialog open onClose={() => {}} profiles={[makeProfile()]} />, {
      preloadedState: authenticatedState(),
    });
    for (const label of [
      "Health profile",
      "Medications",
      "Appointments",
      "Records & documents",
      "Lab results",
      "Treatment plans",
    ]) {
      await user.click(screen.getByLabelText(label));
    }
    await user.click(screen.getByLabelText("Email them the link"));
    await user.type(screen.getByLabelText(/Recipient name/), "Clinic");
    await user.click(screen.getByRole("button", { name: "Create share link" }));

    expect(
      screen.getByText("Choose at least one type of information to share."),
    ).toBeInTheDocument();
    expect(screen.getByText("Enter an email address to send the link to.")).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });
});
