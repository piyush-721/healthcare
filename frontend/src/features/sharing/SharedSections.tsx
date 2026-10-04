"use client";

import { Download } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Badge, Button, DetailList, EmptyState } from "@/components/ui";
import { useToast } from "@/hooks/useToast";
import { downloadProtectedFile } from "@/lib/api/download";
import { formatBytes, formatDate, formatDateTime, formatTime, humanize } from "@/lib/format";
import { SHARE_TOKEN_HEADER, sharedDocumentDownloadUrl } from "@/services/sharing";
import type {
  Allergy,
  Appointment,
  LabReport,
  MedicalCondition,
  MedicalDocument,
  Medication,
  TreatmentPlan,
  VaccinationRecord,
  VitalRecord,
} from "@/types/api";

import {
  BLOOD_TYPE_LABELS,
  SEX_LABELS,
  VITAL_LABELS,
  formatNumber,
  formatVital,
} from "../health-profile/config";

type SectionData = Record<string, unknown>;

/** Section payloads are plain dicts; pull out a typed list defensively. */
function listOf<T>(data: SectionData, key: string): T[] {
  const value = data[key];
  return Array.isArray(value) ? (value as T[]) : [];
}

const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ");

function Block({ title, children, count }: { title: string; children: ReactNode; count?: number }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-800">
        {title}
        {count !== undefined && <span className="ml-1 font-normal text-slate-500">({count})</span>}
      </h3>
      {children}
    </section>
  );
}

function ItemList({ children }: { children: ReactNode }) {
  return (
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
      {children}
    </ul>
  );
}

function Item({
  title,
  details,
  meta,
}: {
  title: ReactNode;
  details?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <li className="space-y-1 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
        {title}
      </div>
      {details ? <div className="text-sm text-slate-600">{details}</div> : null}
      {meta ? <div className="text-xs text-slate-500">{meta}</div> : null}
    </li>
  );
}

function None({ children }: { children: string }) {
  return (
    <p className="rounded-lg border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
      {children}
    </p>
  );
}

type SharedProfile = {
  full_name?: string;
  date_of_birth?: string | null;
  sex?: string;
  blood_type?: string;
  height_cm?: string | null;
};

export function ProfileSection({ data }: { data: SectionData }) {
  const profile = (data.profile ?? {}) as SharedProfile;
  const allergies = listOf<Allergy>(data, "allergies");
  const conditions = listOf<MedicalCondition>(data, "conditions");
  const vaccinations = listOf<VaccinationRecord>(data, "vaccinations");
  const vitals = listOf<VitalRecord>(data, "vitals");
  return (
    <div className="space-y-6">
      <Block title="Basics">
        <DetailList
          items={[
            { label: "Name", value: profile.full_name },
            {
              label: "Date of birth",
              value: profile.date_of_birth ? formatDate(profile.date_of_birth) : null,
            },
            {
              label: "Sex",
              value: profile.sex ? (SEX_LABELS[profile.sex] ?? humanize(profile.sex)) : null,
            },
            {
              label: "Blood type",
              value: profile.blood_type
                ? (BLOOD_TYPE_LABELS[profile.blood_type] ?? profile.blood_type)
                : null,
            },
            {
              label: "Height",
              value: profile.height_cm ? `${formatNumber(profile.height_cm)} cm` : null,
            },
          ]}
        />
      </Block>
      <Block title="Allergies" count={allergies.length}>
        {allergies.length ? (
          <ItemList>
            {allergies.map((a) => (
              <Item
                key={a.id}
                title={
                  <>
                    {a.substance}
                    {a.severity && a.severity !== "UNKNOWN" && (
                      <Badge>{humanize(a.severity)}</Badge>
                    )}
                  </>
                }
                details={a.reaction ? `Reaction: ${a.reaction}` : undefined}
                meta={join(a.noted_on ? `Noted ${formatDate(a.noted_on)}` : null, a.notes)}
              />
            ))}
          </ItemList>
        ) : (
          <None>No allergies recorded.</None>
        )}
      </Block>
      <Block title="Conditions" count={conditions.length}>
        {conditions.length ? (
          <ItemList>
            {conditions.map((c) => (
              <Item
                key={c.id}
                title={
                  <>
                    {c.name}
                    <Badge tone="info">{humanize(c.status ?? "ACTIVE")}</Badge>
                  </>
                }
                details={c.notes || undefined}
                meta={join(
                  c.diagnosed_on ? `Diagnosed ${formatDate(c.diagnosed_on)}` : null,
                  c.resolved_on ? `Resolved ${formatDate(c.resolved_on)}` : null,
                )}
              />
            ))}
          </ItemList>
        ) : (
          <None>No conditions recorded.</None>
        )}
      </Block>
      <Block title="Vitals (most recent 50)" count={vitals.length}>
        {vitals.length ? (
          <ItemList>
            {vitals.map((v) => (
              <Item
                key={v.id}
                title={
                  <>
                    <span>{VITAL_LABELS[v.vital_type] ?? humanize(v.vital_type)}</span>
                    <span className="font-semibold tabular-nums">{formatVital(v)}</span>
                  </>
                }
                details={v.notes || undefined}
                meta={formatDateTime(v.measured_at)}
              />
            ))}
          </ItemList>
        ) : (
          <None>No vitals recorded.</None>
        )}
      </Block>
      <Block title="Vaccinations" count={vaccinations.length}>
        {vaccinations.length ? (
          <ItemList>
            {vaccinations.map((v) => (
              <Item
                key={v.id}
                title={
                  <>
                    {v.vaccine_name}
                    {v.dose_number ? <Badge>Dose {v.dose_number}</Badge> : null}
                  </>
                }
                details={join(`Given ${formatDate(v.administered_on)}`, v.administered_by)}
                meta={v.next_dose_due ? `Next dose due ${formatDate(v.next_dose_due)}` : undefined}
              />
            ))}
          </ItemList>
        ) : (
          <None>No vaccinations recorded.</None>
        )}
      </Block>
    </div>
  );
}

export function MedicationsSection({ data }: { data: SectionData }) {
  const meds = listOf<Medication>(data, "medications");
  if (!meds.length)
    return (
      <EmptyState
        title="No current medications"
        description="No active or paused medications are recorded."
      />
    );
  return (
    <ItemList>
      {meds.map((m) => (
        <Item
          key={m.id}
          title={
            <>
              {m.name}
              <span className="font-normal text-slate-600">{m.dosage}</span>
              <Badge tone={m.status === "ACTIVE" ? "success" : "neutral"}>
                {humanize(m.status)}
              </Badge>
            </>
          }
          details={join(
            m.form ? humanize(m.form) : null,
            m.frequency ? humanize(m.frequency) : null,
            m.schedules?.length
              ? `at ${m.schedules.map((s) => formatTime(s.time_of_day)).join(", ")}`
              : null,
            m.instructions,
          )}
          meta={join(
            `Started ${formatDate(m.start_date)}`,
            m.end_date ? `Ends ${formatDate(m.end_date)}` : null,
            m.prescribed_by_detail?.name ? `Prescribed by ${m.prescribed_by_detail.name}` : null,
          )}
        />
      ))}
    </ItemList>
  );
}

export function AppointmentsSection({ data }: { data: SectionData }) {
  const appts = listOf<Appointment>(data, "appointments");
  if (!appts.length)
    return <EmptyState title="No appointments" description="No appointments are recorded." />;
  return (
    <ItemList>
      {appts.map((a) => (
        <Item
          key={a.id}
          title={
            <>
              {a.title}
              <Badge tone="neutral">{humanize(a.status)}</Badge>
            </>
          }
          details={
            <>
              {join(
                formatDateTime(a.scheduled_at),
                a.provider_detail?.name || a.provider_name,
                a.location,
              )}
              {a.reason && <p className="mt-0.5">Reason: {a.reason}</p>}
              {a.notes?.length ? (
                <ul className="mt-1 space-y-1 border-l-2 border-slate-200 pl-3">
                  {a.notes.map((n) => (
                    <li key={n.id} className="text-sm">
                      <span className="whitespace-pre-line">{n.body}</span>
                      <span className="block text-xs text-slate-500">
                        {join(n.author_name, formatDate(n.created_at))}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          }
          meta={a.kind ? humanize(a.kind) : undefined}
        />
      ))}
    </ItemList>
  );
}

type SharedRecord = {
  id: string;
  title: string;
  record_type: string;
  record_date: string;
  description: string;
  provider: string | null;
};

export function DocumentsSection({ data, token }: { data: SectionData; token: string }) {
  const records = listOf<SharedRecord>(data, "records");
  const documents = listOf<MedicalDocument>(data, "documents");
  const [downloading, setDownloading] = useState<string | null>(null);
  const toast = useToast();

  const download = async (doc: MedicalDocument) => {
    setDownloading(doc.id);
    try {
      await downloadProtectedFile(
        sharedDocumentDownloadUrl(doc.id),
        doc.original_filename || doc.title,
        {
          [SHARE_TOKEN_HEADER]: token,
        },
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The file could not be downloaded.");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-6">
      <Block title="Documents" count={documents.length}>
        {documents.length ? (
          <ItemList>
            {documents.map((d) => (
              <li
                key={d.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                    {d.title}
                    <Badge>{humanize(d.document_type)}</Badge>
                  </p>
                  <p className="text-xs text-slate-500">
                    {join(
                      d.document_date ? formatDate(d.document_date) : null,
                      d.original_filename,
                      d.size_bytes ? formatBytes(d.size_bytes) : null,
                    )}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={downloading === d.id}
                  onClick={() => download(d)}
                  icon={<Download className="size-4" aria-hidden />}
                  aria-label={`Download ${d.title}`}
                >
                  Download
                </Button>
              </li>
            ))}
          </ItemList>
        ) : (
          <None>No documents available.</None>
        )}
      </Block>
      {records.length > 0 && (
        <Block title="Medical records" count={records.length}>
          <ItemList>
            {records.map((r) => (
              <Item
                key={r.id}
                title={
                  <>
                    {r.title}
                    <Badge>{humanize(r.record_type)}</Badge>
                  </>
                }
                details={r.description || undefined}
                meta={join(formatDate(r.record_date), r.provider)}
              />
            ))}
          </ItemList>
        </Block>
      )}
    </div>
  );
}

export function LabResultsSection({ data }: { data: SectionData }) {
  const reports = listOf<LabReport>(data, "lab_reports");
  if (!reports.length)
    return <EmptyState title="No lab reports" description="No lab reports are recorded." />;
  return (
    <div className="space-y-4">
      {reports.map((r) => (
        <section key={r.id} className="rounded-lg border border-slate-200 bg-white">
          <header className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">{r.title}</h3>
            <p className="text-xs text-slate-500">
              {join(
                formatDate(r.report_date),
                r.lab_name,
                r.ordered_by_detail?.name ? `Ordered by ${r.ordered_by_detail.name}` : null,
              )}
            </p>
          </header>
          {r.results?.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <caption className="sr-only">Results for {r.title}</caption>
                <thead className="bg-slate-50 text-left text-xs text-slate-600 uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-semibold">
                      Test
                    </th>
                    <th scope="col" className="px-4 py-2 font-semibold">
                      Result
                    </th>
                    <th scope="col" className="px-4 py-2 font-semibold">
                      Reference range (as reported)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {r.results.map((res) => (
                    <tr key={res.id}>
                      <td className="px-4 py-2 text-slate-900">{res.test_name}</td>
                      <td className="px-4 py-2 text-slate-900 tabular-nums">
                        {res.value !== null && res.value !== undefined && res.value !== ""
                          ? `${formatNumber(res.value)}${res.unit ? ` ${res.unit}` : ""}`
                          : res.value_text || "—"}
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {res.reference_text ||
                          (res.reference_low || res.reference_high
                            ? `${res.reference_low ? formatNumber(res.reference_low) : ""}–${res.reference_high ? formatNumber(res.reference_high) : ""}${res.unit ? ` ${res.unit}` : ""}`
                            : "—")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-4 py-3 text-sm text-slate-500">No individual results recorded.</p>
          )}
          {r.notes && (
            <p className="border-t border-slate-100 px-4 py-2 text-sm text-slate-600">{r.notes}</p>
          )}
        </section>
      ))}
    </div>
  );
}

export function TreatmentPlansSection({ data }: { data: SectionData }) {
  const plans = listOf<TreatmentPlan>(data, "treatment_plans");
  if (!plans.length)
    return (
      <EmptyState
        title="No treatment plans"
        description="No current treatment plans are recorded."
      />
    );
  return (
    <div className="space-y-4">
      {plans.map((p) => (
        <section key={p.id} className="rounded-lg border border-slate-200 bg-white">
          <header className="space-y-1 border-b border-slate-100 px-4 py-3">
            <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
              {p.title}
              <Badge tone="neutral">{humanize(p.status ?? "ACTIVE")}</Badge>
            </h3>
            <p className="text-xs text-slate-500">
              {join(
                `Started ${formatDate(p.start_date)}`,
                p.next_review_date ? `Next review ${formatDate(p.next_review_date)}` : null,
                p.provider_detail?.name,
              )}
            </p>
            {p.description && (
              <p className="text-sm whitespace-pre-line text-slate-600">{p.description}</p>
            )}
          </header>
          {p.tasks.length ? (
            <ul className="divide-y divide-slate-100">
              {p.tasks.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm"
                >
                  <span className="text-slate-800">{t.title}</span>
                  <span className="flex items-center gap-2 text-xs text-slate-500">
                    {t.due_date ? `Due ${formatDate(t.due_date)}` : null}
                    <Badge tone={t.status === "DONE" ? "success" : "neutral"}>
                      {humanize(t.status ?? "PENDING")}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm text-slate-500">No tasks.</p>
          )}
        </section>
      ))}
    </div>
  );
}
