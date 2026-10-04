import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { authenticatedState, makeProfile, mockApi, renderWithStore } from "@/test/utils";
import type { Medication, TodayDose } from "@/types/api";

import { MedicationForm } from "./MedicationFormDialog";
import { MedicationsPage } from "./MedicationsPage";
import { buildMedicationPayload, initialMedicationValues, validateMedication } from "./schedule";
import { TodayDoses } from "./TodayDoses";

const empty = { count: 0, next: null, previous: null, results: [] };

describe("schedule helpers", () => {
  it("rejects duplicate times and an end date before the start date", () => {
    const values = {
      ...initialMedicationValues(),
      name: "Metformin",
      dosage: "500 mg",
      frequency: "TWICE_DAILY" as const,
      times: ["08:00", "08:00"],
      start_date: "2026-10-04",
      end_date: "2026-10-01",
    };
    const errors = validateMedication(values);
    expect(errors.schedules).toBe("Each time must be different.");
    expect(errors.end_date).toMatch(/before the start date/);
  });

  it("builds sorted schedules with shared weekdays, and none for as-needed", () => {
    const values = {
      ...initialMedicationValues(),
      name: " Metformin ",
      dosage: "500 mg",
      frequency: "CUSTOM" as const,
      times: ["20:00", "08:00"],
      days: [4, 0, 2],
      start_date: "2026-10-04",
    };
    const payload = buildMedicationPayload(values);
    expect(payload.name).toBe("Metformin");
    expect(payload.end_date).toBeNull();
    expect(payload.schedules).toEqual([
      { time_of_day: "08:00", days_of_week: [0, 2, 4] },
      { time_of_day: "20:00", days_of_week: [0, 2, 4] },
    ]);
    expect(buildMedicationPayload({ ...values, frequency: "AS_NEEDED" }).schedules).toEqual([]);
  });
});

describe("MedicationForm schedule builder", () => {
  it("blocks duplicate times, then posts the schedule payload once fixed", async () => {
    const calls = mockApi([
      { path: "/api/v1/profiles/", body: [makeProfile()] },
      { path: "/api/v1/providers/", body: empty },
      {
        method: "POST",
        path: "/api/v1/medications/",
        status: 201,
        body: { id: "m1", name: "Metformin" },
      },
    ]);
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithStore(<MedicationForm onClose={onClose} />, { preloadedState: authenticatedState() });

    await user.type(screen.getByLabelText(/^Medication name/), "Metformin");
    await user.type(screen.getByLabelText(/^Dosage/), "500 mg");
    await user.selectOptions(screen.getByLabelText(/^Frequency/), "TWICE_DAILY");

    // Suggested defaults for twice daily.
    expect(screen.getByLabelText("Time 1")).toHaveValue("08:00");
    expect(screen.getByLabelText("Time 2")).toHaveValue("20:00");

    fireEvent.change(screen.getByLabelText("Time 2"), { target: { value: "08:00" } });
    await user.click(screen.getByRole("button", { name: "Add medication" }));
    expect(await screen.findByText("Each time must be different.")).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST")).toBe(false);

    fireEvent.change(screen.getByLabelText("Time 2"), { target: { value: "21:30" } });
    await user.click(screen.getByRole("button", { name: "Monday" }));
    await user.click(screen.getByRole("button", { name: "Add medication" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const post = calls.find((c) => c.method === "POST");
    expect(post?.body).toMatchObject({
      name: "Metformin",
      dosage: "500 mg",
      frequency: "TWICE_DAILY",
      schedules: [
        { time_of_day: "08:00", days_of_week: [0] },
        { time_of_day: "21:30", days_of_week: [0] },
      ],
    });
  });
});

describe("TodayDoses", () => {
  it("logs a dose as taken via the medication log endpoint", async () => {
    const dose: TodayDose = {
      medication_id: "med-1",
      medication_name: "Metformin",
      dosage: "500 mg",
      instructions: "",
      schedule_id: "sch-1",
      scheduled_for: "2026-10-04T08:00:00Z",
      status: "PENDING",
    };
    const calls = mockApi([
      { path: "/api/v1/profiles/", body: [makeProfile()] },
      {
        path: "/api/v1/medications/today/",
        body: { date: "2026-10-04", timezone: "UTC", doses: [dose] },
      },
      {
        method: "POST",
        path: "/api/v1/medications/med-1/log/",
        status: 201,
        body: { id: "log-1", status: "TAKEN" },
      },
    ]);
    const user = userEvent.setup();
    renderWithStore(<TodayDoses />, { preloadedState: authenticatedState() });

    const list = await screen.findByRole("list", { name: "Today's doses" });
    expect(within(list).getByText("Upcoming")).toBeInTheDocument();
    await user.click(within(list).getByRole("button", { name: /as taken/ }));

    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
    const post = calls.find((c) => c.method === "POST");
    expect(post?.url).toBe("/api/v1/medications/med-1/log/");
    expect(post?.body).toEqual({
      schedule: "sch-1",
      scheduled_for: "2026-10-04T08:00:00Z",
      status: "TAKEN",
      note: "",
    });
  });
});

describe("MedicationsPage permissions", () => {
  const medication = {
    id: "med-1",
    profile: "p2",
    name: "Metformin",
    dosage: "500 mg",
    form: "TABLET",
    frequency: "ONCE_DAILY",
    start_date: "2026-01-01",
    status: "ACTIVE",
    paused_at: null,
    prescribed_by_detail: null,
    schedules: [{ id: "s1", time_of_day: "08:00:00", days_of_week: [] }],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  } as unknown as Medication;

  const routes = (permissions: string[]) => [
    {
      path: "/api/v1/profiles/",
      body: [makeProfile({ is_self: false, access_role: "CAREGIVER", permissions } as never)],
    },
    {
      path: "/api/v1/medications/today/",
      body: { date: "2026-10-04", timezone: "UTC", doses: [] },
    },
    {
      path: "/api/v1/medications/",
      body: { count: 1, next: null, previous: null, results: [medication] },
    },
  ];

  it("hides 'Add medication' for a view-only caregiver", async () => {
    mockApi(routes(["VIEW_MEDICATIONS"]));
    renderWithStore(<MedicationsPage />, { preloadedState: authenticatedState() });
    expect(await screen.findByRole("link", { name: "Metformin" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add medication" })).not.toBeInTheDocument();
  });

  it("shows 'Add medication' when the caregiver can manage medications", async () => {
    mockApi(routes(["VIEW_MEDICATIONS", "MANAGE_MEDICATIONS"]));
    renderWithStore(<MedicationsPage />, { preloadedState: authenticatedState() });
    expect(await screen.findByRole("button", { name: "Add medication" })).toBeInTheDocument();
  });
});
