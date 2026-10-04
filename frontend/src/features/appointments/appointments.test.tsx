import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { authenticatedState, makeProfile, mockApi, renderWithStore } from "@/test/utils";
import type { Appointment } from "@/types/api";

import { AppointmentsPage } from "./AppointmentsPage";
import { appointmentStatus } from "./constants";

function appt(overrides: Partial<Appointment>): Appointment {
  return {
    id: "a",
    profile: "p",
    title: "Visit",
    provider: null,
    provider_detail: null,
    provider_name: "",
    location: "",
    kind: "IN_PERSON",
    scheduled_at: "2026-10-10T09:00:00Z",
    duration_minutes: 30,
    reason: "",
    status: "SCHEDULED",
    cancellation_reason: "",
    follow_up_date: null,
    reminder_minutes_before: 1440,
    needs_update: false,
    notes: [],
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    ...overrides,
  } as Appointment;
}

describe("appointmentStatus", () => {
  it("maps statuses to text labels", () => {
    expect(appointmentStatus({ status: "SCHEDULED", needs_update: false }).label).toBe("Upcoming");
    expect(appointmentStatus({ status: "SCHEDULED", needs_update: true }).label).toBe(
      "Needs update",
    );
    expect(appointmentStatus({ status: "CANCELLED", needs_update: false }).label).toBe("Cancelled");
    expect(appointmentStatus({ status: "COMPLETED", needs_update: false }).label).toBe("Completed");
    expect(appointmentStatus({ status: "MISSED", needs_update: false }).label).toBe("Missed");
  });
});

describe("AppointmentsPage", () => {
  it("shows Upcoming / Needs update / Cancelled badges and the needs-update alert", async () => {
    const results = [
      appt({ id: "a1", title: "Cardiology follow-up", provider_name: "Dr. Rao" }),
      appt({
        id: "a2",
        title: "Dental check",
        needs_update: true,
        scheduled_at: "2026-10-01T09:00:00Z",
      }),
      appt({ id: "a3", title: "Eye exam", status: "CANCELLED" }),
    ];
    mockApi([
      { path: "/api/v1/profiles/", body: [makeProfile()] },
      {
        path: "/api/v1/appointments/",
        body: { count: results.length, next: null, previous: null, results },
      },
    ]);
    renderWithStore(<AppointmentsPage />, { preloadedState: authenticatedState() });

    const row = async (title: string) =>
      (await screen.findByRole("link", { name: title })).closest("li") as HTMLElement;
    expect(within(await row("Cardiology follow-up")).getByText("Upcoming")).toBeInTheDocument();
    expect(within(await row("Cardiology follow-up")).getByText("Dr. Rao")).toBeInTheDocument();
    expect(within(await row("Dental check")).getByText("Needs update")).toBeInTheDocument();
    expect(within(await row("Eye exam")).getByText("Cancelled")).toBeInTheDocument();
    expect(await screen.findByText(/past appointments need an update/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New appointment" })).toBeInTheDocument();
  });
});
