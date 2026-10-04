import type { LabReport, LabResult } from "@/types/api";

export type ResultRow = {
  key: string;
  test_name: string;
  value: string;
  value_text: string;
  unit: string;
  reference_low: string;
  reference_high: string;
};

export type RowField = "test_name" | "value" | "reference_low" | "reference_high";
export type RowErrors = Partial<Record<RowField, string>>;

let rowCounter = 0;
const nextKey = () => `row-${(rowCounter += 1)}`;

export function emptyRow(): ResultRow {
  return {
    key: nextKey(),
    test_name: "",
    value: "",
    value_text: "",
    unit: "",
    reference_low: "",
    reference_high: "",
  };
}

export function rowFromResult(result: LabResult): ResultRow {
  return {
    key: nextKey(),
    test_name: result.test_name,
    value: result.value ?? "",
    value_text: result.value_text ?? "",
    unit: result.unit ?? "",
    reference_low: result.reference_low ?? "",
    reference_high: result.reference_high ?? "",
  };
}

export function isBlankRow(row: ResultRow): boolean {
  return [
    row.test_name,
    row.value,
    row.value_text,
    row.unit,
    row.reference_low,
    row.reference_high,
  ].every((v) => v.trim() === "");
}

const isNumeric = (v: string) => v.trim() !== "" && Number.isFinite(Number(v.trim()));

/** Client-side checks for one result row. Completely blank rows are ignored on submit. */
export function validateRow(row: ResultRow): RowErrors {
  const errors: RowErrors = {};
  if (!row.test_name.trim()) errors.test_name = "Enter the test name.";
  const value = row.value.trim();
  if (!value && !row.value_text.trim()) errors.value = "Enter a numeric value or a text result.";
  else if (value && !isNumeric(value))
    errors.value = "Value must be a number — use “Text result” otherwise.";
  if (row.reference_low.trim() && !isNumeric(row.reference_low))
    errors.reference_low = "Must be a number.";
  if (row.reference_high.trim() && !isNumeric(row.reference_high))
    errors.reference_high = "Must be a number.";
  if (
    !errors.reference_low &&
    !errors.reference_high &&
    isNumeric(row.reference_low) &&
    isNumeric(row.reference_high) &&
    Number(row.reference_high) < Number(row.reference_low)
  ) {
    errors.reference_high = "High must be greater than or equal to low.";
  }
  return errors;
}

/** Validate all non-blank rows; returns errors keyed by row key (empty object when valid). */
export function validateRows(rows: ResultRow[]): Record<string, RowErrors> {
  const result: Record<string, RowErrors> = {};
  for (const row of rows) {
    if (isBlankRow(row)) continue;
    const errors = validateRow(row);
    if (Object.keys(errors).length) result[row.key] = errors;
  }
  return result;
}

export function rowToRequest(row: ResultRow) {
  const opt = (v: string) => (v.trim() === "" ? null : v.trim());
  return {
    test_name: row.test_name.trim(),
    value: opt(row.value),
    value_text: row.value_text.trim(),
    unit: row.unit.trim(),
    reference_low: opt(row.reference_low),
    reference_high: opt(row.reference_high),
  };
}

export type ReportFormValues = {
  title: string;
  lab_name: string;
  report_date: string;
  ordered_by: string | null;
  document: string | null;
  notes: string;
};

export function reportFormValues(report: LabReport | undefined, today: string): ReportFormValues {
  return {
    title: report?.title ?? "",
    lab_name: report?.lab_name ?? "",
    report_date: report?.report_date ?? today,
    ordered_by: report?.ordered_by ?? null,
    document: report?.document ?? null,
    notes: report?.notes ?? "",
  };
}
