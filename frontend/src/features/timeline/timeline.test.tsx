import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { authenticatedState, makeProfile, mockApi, renderWithStore } from "@/test/utils";
import type { TimelineEvent } from "@/types/api";

import { formatDayLabel, groupByDay } from "./groupEvents";
import { TimelinePage } from "./TimelinePage";

const ev = (
  id: string,
  occurred_at: string,
  overrides: Partial<TimelineEvent> = {},
): TimelineEvent => ({
  id,
  type: "RECORD",
  occurred_at,
  all_day: false,
  title: `Event ${id}`,
  subtitle: "",
  resource: "record",
  resource_id: id,
  status: "",
  ...overrides,
});

describe("groupByDay", () => {
  it("groups events by calendar day in order and formats headers", () => {
    const groups = groupByDay([
      ev("a", "2026-03-05T15:00:00"),
      ev("b", "2026-03-05T09:00:00"),
      ev("c", "2026-03-04T00:00:00+05:30", { all_day: true }),
    ]);
    expect(groups.map((g) => g.day)).toEqual(["2026-03-05", "2026-03-04"]);
    expect(groups[0].events.map((e) => e.id)).toEqual(["a", "b"]);
    expect(formatDayLabel("2026-10-03")).toMatch(/^Sat, 3 Oct 2026$/);
  });
});

describe("TimelinePage", () => {
  it("renders day groups and loads more with next_cursor", async () => {
    const page1 = {
      results: [
        ev("1", "2026-02-10T10:00:00", {
          title: "Dental visit",
          type: "APPOINTMENT",
          resource: "appointment",
          status: "COMPLETED",
        }),
        ev("2", "2026-02-09T00:00:00", {
          title: "Annual blood panel",
          type: "LAB_REPORT",
          resource: "lab_report",
          all_day: true,
        }),
      ],
      next_cursor: "CURSOR-1",
      available_types: ["APPOINTMENT", "LAB_REPORT"],
    };
    const page2 = {
      results: [
        ev("3", "2025-12-01T00:00:00", {
          title: "Flu vaccine",
          type: "VACCINATION",
          resource: "vaccination",
          all_day: true,
        }),
      ],
      next_cursor: null,
      available_types: ["APPOINTMENT", "LAB_REPORT"],
    };
    const calls = mockApi([{ path: "/api/v1/profiles/", body: [makeProfile()] }]);
    // Route by cursor: wrap the mocked fetch.
    const base = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(String(input), init);
      const url = new URL(request.url);
      if (url.pathname === "/api/v1/timeline/") {
        calls.push({ method: "GET", url: url.pathname + url.search, body: undefined });
        const body = url.searchParams.get("cursor") === "CURSOR-1" ? page2 : page1;
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return base(input, init);
    }) as typeof fetch;

    const user = userEvent.setup();
    renderWithStore(<TimelinePage />, { preloadedState: authenticatedState() });

    expect(await screen.findByText("Dental visit")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tue, 10 Feb 2026" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mon, 9 Feb 2026" })).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Annual blood panel/ })).toHaveAttribute(
      "href",
      "/labs/2",
    );
    // Chips come from available_types.
    expect(
      screen.getByRole("button", { name: "Appointments", pressed: false }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Vaccinations" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("Flu vaccine")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mon, 1 Dec 2025" })).toBeInTheDocument();
    // Earlier pages are kept.
    expect(screen.getByText("Dental visit")).toBeInTheDocument();
    expect(calls.some((c) => c.url.includes("cursor=CURSOR-1"))).toBe(true);
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument(),
    );
  });

  it("separates upcoming events", async () => {
    mockApi([
      { path: "/api/v1/profiles/", body: [makeProfile()] },
      {
        path: "/api/v1/timeline/",
        body: {
          results: [
            ev("f", "2099-01-01T10:00:00Z", {
              title: "Future check-up",
              type: "APPOINTMENT",
              resource: "appointment",
            }),
            ev("p", "2020-01-01T10:00:00Z", { title: "Old record" }),
          ],
          next_cursor: null,
          available_types: ["APPOINTMENT", "RECORD"],
        },
      },
    ]);
    renderWithStore(<TimelinePage />, { preloadedState: authenticatedState() });
    expect(await screen.findByRole("heading", { name: "Upcoming" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Past" })).toBeInTheDocument();
  });
});
