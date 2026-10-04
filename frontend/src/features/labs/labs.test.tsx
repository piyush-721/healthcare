import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { authenticatedState, makeProfile, mockApi, renderWithStore } from "@/test/utils";
import type { LabResult, TrendPoint } from "@/types/api";

import { emptyRow, validateRow } from "./labForm";
import { LabReportForm } from "./LabReportForm";
import { LabResultsTable } from "./LabReportDetailPage";
import { LabTrendCard, referenceBand } from "./LabTrendCard";
import { RANGE_LABELS, RangeBadge } from "./RangeBadge";

const CLINICAL_WORDS =
  /\b(normal|abnormal|high|low|good|bad|healthy|unhealthy|elevated|deficien|critical|concern)/i;

describe("validateRow", () => {
  it("requires a name and a value", () => {
    const errors = validateRow(emptyRow());
    expect(errors.test_name).toBeTruthy();
    expect(errors.value).toBeTruthy();
  });

  it("accepts a text result instead of a numeric value", () => {
    expect(
      validateRow({ ...emptyRow(), test_name: "Urine glucose", value_text: "Negative" }),
    ).toEqual({});
  });

  it("rejects non-numeric values and a high bound below the low bound", () => {
    const errors = validateRow({
      ...emptyRow(),
      test_name: "Hb",
      value: "abc",
      reference_low: "12",
      reference_high: "10",
    });
    expect(errors.value).toBeTruthy();
    expect(errors.reference_high).toMatch(/greater than or equal/i);
    expect(
      validateRow({
        ...emptyRow(),
        test_name: "Hb",
        value: "13",
        reference_low: "12",
        reference_high: "12",
      }),
    ).toEqual({});
  });
});

describe("LabReportForm", () => {
  it("shows row errors and does not submit when a result row is incomplete", async () => {
    const calls = mockApi([
      { path: "/api/v1/profiles/", body: [makeProfile()] },
      { path: "/api/v1/providers/", body: { count: 0, next: null, previous: null, results: [] } },
      { path: "/api/v1/documents/", body: { count: 0, next: null, previous: null, results: [] } },
      { method: "POST", path: "/api/v1/lab-reports/", status: 201, body: { id: "r1" } },
    ]);
    const user = userEvent.setup();
    renderWithStore(<LabReportForm onSaved={() => {}} onCancel={() => {}} />, {
      preloadedState: authenticatedState(),
    });

    await user.type(screen.getByLabelText(/^Title/), "Blood panel");
    await user.type(screen.getByLabelText(/^Test name/), "Haemoglobin");
    await user.type(screen.getByLabelText(/^Range low/), "13");
    await user.type(screen.getByLabelText(/^Range high/), "12");
    await user.click(screen.getByRole("button", { name: "Add lab report" }));

    expect(await screen.findByText("Enter a numeric value or a text result.")).toBeInTheDocument();
    expect(screen.getByText("High must be greater than or equal to low.")).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST")).toBe(false);

    await user.type(screen.getByLabelText(/^Value/), "13.5");
    await user.clear(screen.getByLabelText(/^Range high/));
    await user.type(screen.getByLabelText(/^Range high/), "17");
    await user.click(screen.getByRole("button", { name: "Add lab report" }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
    const post = calls.find((c) => c.method === "POST");
    expect(post?.body).toMatchObject({
      title: "Blood panel",
      results: [
        { test_name: "Haemoglobin", value: "13.5", reference_low: "13", reference_high: "17" },
      ],
    });
  });
});

describe("range badge wording", () => {
  it("uses neutral, report-relative wording only", () => {
    for (const position of ["BELOW", "WITHIN", "ABOVE"]) {
      const { unmount } = render(<RangeBadge position={position} />);
      const text = screen.getByText(RANGE_LABELS[position]).textContent ?? "";
      expect(text).toMatch(/report range$/);
      expect(text).not.toMatch(CLINICAL_WORDS);
      unmount();
    }
  });

  it("renders nothing when there is no range", () => {
    const { container } = render(<RangeBadge position={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("flags machine-extracted results and never uses clinical judgement words", () => {
    const base: LabResult = {
      id: "x1",
      test_name: "Glucose",
      test_key: "glucose",
      value: "130",
      unit: "mg/dL",
      reference_low: "70",
      reference_high: "100",
      range_position: "ABOVE",
      source: "MACHINE_EXTRACTED",
    };
    render(<LabResultsTable results={[base]} />);
    expect(screen.getAllByText("Above report range").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Machine-extracted — verify/).length).toBeGreaterThan(0);
    expect(document.body.textContent ?? "").not.toMatch(CLINICAL_WORDS);
  });
});

describe("LabTrendCard", () => {
  const points: TrendPoint[] = [
    {
      report_id: "a",
      report_date: "2026-01-10",
      value: "5.1",
      unit: "mmol/L",
      reference_low: "3.5",
      reference_high: "5.5",
      range_position: "WITHIN",
    },
    {
      report_id: "b",
      report_date: "2026-06-10",
      value: "5.9",
      unit: "mmol/L",
      reference_low: "3.5",
      reference_high: "5.5",
      range_position: "ABOVE",
    },
  ];

  it("computes the band from the latest report", () => {
    expect(referenceBand(points)).toEqual({ low: 3.5, high: 5.5, varies: false });
    expect(referenceBand([{ ...points[0], reference_low: null, reference_high: null }])).toBeNull();
  });

  it("renders a figure with caption and an accessible data table", async () => {
    mockApi([
      {
        path: "/api/v1/lab-reports/tests/",
        body: [
          {
            test_key: "potassium",
            test_name: "Potassium",
            unit: "mmol/L",
            count: 2,
            latest: "2026-06-10",
          },
        ],
      },
      { path: "/api/v1/lab-reports/trends/", body: { test_key: "potassium", points } },
    ]);
    renderWithStore(<LabTrendCard profileId={undefined} />, {
      preloadedState: authenticatedState(),
    });
    const figure = await screen.findByRole("figure");
    expect(within(figure).getByText(/Potassium \(mmol\/L\) across 2 reports/)).toBeInTheDocument();
    const table = within(figure).getByRole("table", { name: /Potassium values by report date/ });
    expect(within(table).getByText("Above report range")).toBeInTheDocument();
  });
});
