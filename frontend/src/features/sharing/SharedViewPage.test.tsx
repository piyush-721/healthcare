import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { mockApi, renderWithStore } from "@/test/utils";

import { SharedViewPage, sectionsForScopes } from "./SharedViewPage";

function openWithToken(token: string | null) {
  window.history.replaceState(null, "", token ? `/shared#token=${token}` : "/shared");
}

const shareError = (code: string, status = 403) => ({
  path: "/api/v1/shared/",
  status,
  body: { error: { code, message: "denied" } },
});

describe("SharedViewPage", () => {
  afterEach(() => openWithToken(null));

  it("shows the expired message for an expired share", async () => {
    openWithToken("expired-token");
    const calls = mockApi([shareError("SHARE_EXPIRED", 410)]);
    renderWithStore(<SharedViewPage />);
    expect(
      await screen.findByText("Access denied — This sharing permission has expired."),
    ).toBeInTheDocument();
    // The token travels in a header, never in the URL, and is stripped from the address bar.
    expect(calls[0].url).toBe("/api/v1/shared/");
    expect(window.location.hash).toBe("");
  });

  it("shows the revoked message for a revoked share", async () => {
    openWithToken("revoked-token");
    mockApi([shareError("SHARE_REVOKED")]);
    renderWithStore(<SharedViewPage />);
    expect(
      await screen.findByText("Access denied — This sharing permission has been revoked."),
    ).toBeInTheDocument();
  });

  it("explains an invalid link when there is no token", async () => {
    const calls = mockApi([]);
    renderWithStore(<SharedViewPage />);
    expect(await screen.findByText("This link isn't valid")).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it("shows only the shared sections", async () => {
    openWithToken("good-token");
    mockApi([
      {
        path: "/api/v1/shared/",
        body: {
          patient_name: "Alice Patient",
          shared_by: "Alice Patient",
          recipient_name: "Dr. Mehta",
          purpose: "Follow-up",
          scopes: ["MEDICATIONS", "FINANCIAL"],
          expires_at: "2099-01-01T00:00:00Z",
        },
      },
      { path: "/api/v1/shared/medications/", body: { medications: [] } },
    ]);
    renderWithStore(<SharedViewPage />);
    expect(
      await screen.findByRole("heading", { name: "Alice Patient", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Medications" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Medical bills" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Lab results" })).not.toBeInTheDocument();
    expect(await screen.findByText("No current medications")).toBeInTheDocument();
  });
});

describe("sectionsForScopes", () => {
  it("merges documents and bills into one section", () => {
    expect(sectionsForScopes(["DOCUMENTS", "FINANCIAL"])).toEqual([
      { id: "documents", label: "Documents & bills" },
    ]);
  });
});
