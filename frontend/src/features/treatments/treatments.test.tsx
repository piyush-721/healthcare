import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { authenticatedState, makeProfile, mockApi, renderWithStore } from "@/test/utils";
import type { TreatmentPlan, TreatmentTask } from "@/types/api";

import { isOverdue, TreatmentPlanDetailPage } from "./TreatmentPlanDetailPage";

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
    usePathname: () => "/treatments/p1",
    useSearchParams: () => new URLSearchParams(),
    useParams: () => ({ id: "p1" }),
  };
});

const task = (overrides: Partial<TreatmentTask>): TreatmentTask => ({
  id: "t1",
  title: "Book blood test",
  kind: "TEST",
  due_date: null,
  status: "PENDING",
  completed_at: null,
  completed_by_name: "",
  position: 0,
  notes: "",
  created_at: "2026-09-01T00:00:00Z",
  ...overrides,
});

const plan: TreatmentPlan = {
  id: "p1",
  profile: "22222222-2222-2222-2222-222222222222",
  title: "Recovery plan",
  description: "Steps from Dr. Rao",
  provider: null,
  provider_detail: null as unknown as TreatmentPlan["provider_detail"],
  status: "ACTIVE",
  start_date: "2026-09-01",
  next_review_date: "2026-11-01",
  tasks: [
    task({ id: "t1", title: "Book blood test", due_date: "2020-01-01" }),
    task({
      id: "t2",
      title: "Upload scan",
      kind: "UPLOAD",
      status: "DONE",
      completed_at: "2026-09-10T10:00:00Z",
      position: 1,
    }),
  ],
  progress: { done: 1, total: 2, percent: 50 },
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

describe("isOverdue", () => {
  it("only flags pending tasks with a past due date", () => {
    expect(isOverdue(task({ due_date: "2026-10-01" }), "2026-10-04")).toBe(true);
    expect(isOverdue(task({ due_date: "2026-10-01", status: "DONE" }), "2026-10-04")).toBe(false);
    expect(isOverdue(task({ due_date: "2026-10-05" }), "2026-10-04")).toBe(false);
  });
});

describe("TreatmentPlanDetailPage", () => {
  it("toggles a task via PATCH and shows status as text", async () => {
    const calls = mockApi([
      { path: "/api/v1/profiles/", body: [makeProfile()] },
      { path: "/api/v1/treatment-plans/p1/", body: plan },
      {
        method: "PATCH",
        path: "/api/v1/treatment-plans/p1/tasks/t1/",
        body: task({ status: "DONE" }),
      },
    ]);
    const user = userEvent.setup();
    renderWithStore(<TreatmentPlanDetailPage />, { preloadedState: authenticatedState() });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Recovery plan" }),
    ).toBeInTheDocument();
    const progress = screen.getByRole("progressbar", { name: "Checklist progress" });
    expect(progress).toHaveAttribute("aria-valuenow", "50");
    expect(progress).toHaveAttribute("aria-valuetext", "1 of 2 done");

    const tasks = screen.getByRole("list", { name: "Tasks" });
    expect(within(tasks).getByText("Overdue")).toBeInTheDocument();
    expect(within(tasks).getByText("Done")).toBeInTheDocument();

    const checkbox = await screen.findByRole("checkbox", { name: "Book blood test" });
    await waitFor(() => expect(checkbox).toBeEnabled());
    await user.click(checkbox);

    await waitFor(() => expect(calls.some((c) => c.method === "PATCH")).toBe(true));
    const patch = calls.find((c) => c.method === "PATCH");
    expect(patch?.url).toBe("/api/v1/treatment-plans/p1/tasks/t1/");
    expect(patch?.body).toEqual({ status: "DONE" });
  });

  it("marks a task as skipped", async () => {
    const calls = mockApi([
      { path: "/api/v1/profiles/", body: [makeProfile()] },
      { path: "/api/v1/treatment-plans/p1/", body: plan },
      { method: "PATCH", path: /\/tasks\/t1\/$/, body: task({ status: "SKIPPED" }) },
    ]);
    const user = userEvent.setup();
    renderWithStore(<TreatmentPlanDetailPage />, { preloadedState: authenticatedState() });
    await user.click(await screen.findByRole("button", { name: "Skip “Book blood test”" }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ status: "SKIPPED" }),
    );
  });
});
