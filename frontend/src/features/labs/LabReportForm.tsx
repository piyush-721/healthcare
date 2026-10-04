"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";

import { MedicalDisclaimer } from "@/components/domain/MedicalDisclaimer";
import { ProviderSelect } from "@/components/domain/ProviderSelect";
import { Alert, Button, Field, FormActions, Input, Select, Textarea } from "@/components/ui";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useToast } from "@/hooks/useToast";
import { getFieldErrors } from "@/lib/api/errors";
import { formatDate, todayISO } from "@/lib/format";
import { useCreateLabReportMutation, useUpdateLabReportMutation } from "@/services/labs";
import { useDocumentsQuery } from "@/services/records";
import type { LabReport } from "@/types/api";

import {
  emptyRow,
  isBlankRow,
  reportFormValues,
  rowFromResult,
  rowToRequest,
  validateRows,
  type ReportFormValues,
  type ResultRow,
  type RowErrors,
} from "./labForm";

/**
 * Create or edit a lab report. On edit, the results list is sent in full and
 * replaces the stored results (PATCH semantics on the backend).
 */
export function LabReportForm({
  report,
  onSaved,
  onCancel,
}: {
  report?: LabReport;
  onSaved: (report: LabReport) => void;
  onCancel: () => void;
}) {
  const { profileId, can } = useActiveProfile();
  const toast = useToast();
  const [values, setValues] = useState<ReportFormValues>(() =>
    reportFormValues(report, todayISO()),
  );
  const [rows, setRows] = useState<ResultRow[]>(() =>
    report?.results?.length ? report.results.map(rowFromResult) : [emptyRow()],
  );
  const [clientErrors, setClientErrors] = useState<Partial<Record<keyof ReportFormValues, string>>>(
    {},
  );
  const [rowErrors, setRowErrors] = useState<Record<string, RowErrors>>({});
  const [serverError, setServerError] = useState<unknown>(null);

  const canViewDocuments = can("VIEW_DOCUMENTS");
  const { data: documents } = useDocumentsQuery(
    { profile: profileId, document_type: "LAB_REPORT", page_size: 100 },
    { skip: !canViewDocuments },
  );
  const [create, createState] = useCreateLabReportMutation();
  const [update, updateState] = useUpdateLabReportMutation();
  const saving = createState.isLoading || updateState.isLoading;
  const fieldErrors: Record<string, string | undefined> = {
    ...getFieldErrors(serverError),
    ...clientErrors,
  };

  const set = <K extends keyof ReportFormValues>(key: K, value: ReportFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const updateRow = (key: string, patch: Partial<ResultRow>) => {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    if (rowErrors[key]) {
      setRowErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Ignore submits bubbling up from nested forms (e.g. ProviderSelect's "add provider" dialog).
    if (event.target !== event.currentTarget) return;

    const nextClient: typeof clientErrors = {};
    if (!values.title.trim()) nextClient.title = "Enter a title for this report.";
    if (!values.report_date) nextClient.report_date = "Enter the report date.";
    const nextRows = validateRows(rows);
    setClientErrors(nextClient);
    setRowErrors(nextRows);
    if (Object.keys(nextClient).length || Object.keys(nextRows).length) return;

    const body = {
      title: values.title.trim(),
      lab_name: values.lab_name.trim(),
      report_date: values.report_date,
      ordered_by: values.ordered_by,
      document: values.document,
      notes: values.notes,
      results: rows.filter((row) => !isBlankRow(row)).map(rowToRequest),
    };
    setServerError(null);
    try {
      const saved = report
        ? await update({ id: report.id, ...body }).unwrap()
        : await create({ ...body, profile: profileId }).unwrap();
      toast.success(report ? "Lab report updated." : "Lab report added.");
      onSaved(saved);
    } catch (err) {
      setServerError(err);
      if (!Object.keys(getFieldErrors(err)).length) toast.error(err);
    }
  };

  const documentOptions = (documents?.results ?? []).map((doc) => ({
    value: doc.id,
    label: doc.document_date ? `${doc.title} · ${formatDate(doc.document_date)}` : doc.title,
  }));
  // Keep the currently linked document selectable even if it isn't in the list (e.g. archived).
  if (report?.document && !documentOptions.some((o) => o.value === report.document)) {
    documentOptions.unshift({
      value: report.document,
      label: report.document_title || "Linked document",
    });
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit} noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" required error={fieldErrors.title} className="sm:col-span-2">
          <Input
            value={values.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Annual blood panel"
          />
        </Field>
        <Field label="Lab name" error={fieldErrors.lab_name}>
          <Input
            value={values.lab_name}
            onChange={(e) => set("lab_name", e.target.value)}
            placeholder="City Diagnostics"
          />
        </Field>
        <Field label="Report date" required error={fieldErrors.report_date}>
          <Input
            type="date"
            value={values.report_date}
            max={todayISO()}
            onChange={(e) => set("report_date", e.target.value)}
          />
        </Field>
        <div className="sm:col-span-2">
          <ProviderSelect
            label="Ordered by"
            value={values.ordered_by}
            onChange={(id) => set("ordered_by", id)}
            error={fieldErrors.ordered_by}
          />
        </div>
        <Field
          label="Attached document"
          error={fieldErrors.document}
          hint={
            canViewDocuments
              ? "Optional. Upload the PDF under Records first to link it here."
              : undefined
          }
          className="sm:col-span-2"
        >
          <Select
            value={values.document ?? ""}
            onChange={(e) => set("document", e.target.value || null)}
            options={documentOptions}
            placeholder={canViewDocuments ? "No document" : "Not available"}
            disabled={!canViewDocuments}
          />
        </Field>
        <Field label="Notes" error={fieldErrors.notes} className="sm:col-span-2">
          <Textarea value={values.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
        </Field>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-900">Results</legend>
        <p className="text-xs text-slate-500">
          Copy each value and the reference range exactly as printed on the report. Leave a row
          completely empty to skip it.
        </p>
        {fieldErrors.results && <Alert tone="error">{fieldErrors.results}</Alert>}
        <ol className="space-y-3">
          {rows.map((row, index) => {
            const errors = rowErrors[row.key] ?? {};
            return (
              <li
                key={row.key}
                className="rounded-lg border border-slate-200 bg-slate-50/60 p-3"
                aria-label={`Result ${index + 1}`}
              >
                <div className="grid gap-3 sm:grid-cols-6">
                  <Field
                    label="Test name"
                    required
                    error={errors.test_name}
                    className="sm:col-span-3"
                  >
                    <Input
                      value={row.test_name}
                      onChange={(e) => updateRow(row.key, { test_name: e.target.value })}
                      placeholder="Haemoglobin"
                    />
                  </Field>
                  <Field label="Value" error={errors.value} className="sm:col-span-1">
                    <Input
                      inputMode="decimal"
                      value={row.value}
                      onChange={(e) => updateRow(row.key, { value: e.target.value })}
                    />
                  </Field>
                  <Field label="Unit" className="sm:col-span-2">
                    <Input
                      value={row.unit}
                      onChange={(e) => updateRow(row.key, { unit: e.target.value })}
                      placeholder="g/dL"
                    />
                  </Field>
                  <Field
                    label="Text result"
                    hint="If the result isn't a number"
                    className="sm:col-span-2"
                  >
                    <Input
                      value={row.value_text}
                      onChange={(e) => updateRow(row.key, { value_text: e.target.value })}
                      placeholder="Negative"
                    />
                  </Field>
                  <Field label="Range low" error={errors.reference_low} className="sm:col-span-1">
                    <Input
                      inputMode="decimal"
                      value={row.reference_low}
                      onChange={(e) => updateRow(row.key, { reference_low: e.target.value })}
                    />
                  </Field>
                  <Field label="Range high" error={errors.reference_high} className="sm:col-span-1">
                    <Input
                      inputMode="decimal"
                      value={row.reference_high}
                      onChange={(e) => updateRow(row.key, { reference_high: e.target.value })}
                    />
                  </Field>
                  <div className="flex items-end sm:col-span-2 sm:justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setRows((prev) =>
                          prev.length > 1 ? prev.filter((r) => r.key !== row.key) : [emptyRow()],
                        )
                      }
                      icon={<Trash2 className="size-4" aria-hidden />}
                      aria-label={`Remove result ${index + 1}${row.test_name ? ` (${row.test_name})` : ""}`}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setRows((prev) => [...prev, emptyRow()])}
          icon={<Plus className="size-4" aria-hidden />}
        >
          Add result
        </Button>
      </fieldset>

      <MedicalDisclaimer>
        HealthOS stores these values as entered and does not interpret them.
      </MedicalDisclaimer>

      <FormActions>
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {report ? "Save changes" : "Add lab report"}
        </Button>
      </FormActions>
    </form>
  );
}
