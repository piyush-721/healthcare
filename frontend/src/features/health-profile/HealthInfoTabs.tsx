"use client";

import { Activity, AlertCircle, HeartPulse, Phone, Stethoscope, Syringe } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge, Card, CardBody, Tabs } from "@/components/ui";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { formatDate, formatDateTime, humanize, isoToLocalInput } from "@/lib/format";
import {
  useCreateHealthInfoMutation,
  useCreateProviderMutation,
  useDeleteHealthInfoMutation,
  useDeleteProviderMutation,
  useHealthInfoListQuery,
  useProvidersQuery,
  useUpdateHealthInfoMutation,
  useUpdateProviderMutation,
  type HealthInfoKind,
  type HealthInfoMap,
} from "@/services/profiles";
import type { Req } from "@/services/types";
import type {
  Allergy,
  CareProvider,
  EmergencyContact,
  MedicalCondition,
  VaccinationRecord,
  VitalRecord,
} from "@/types/api";

import {
  ALLERGY_FIELDS,
  CONDITION_FIELDS,
  CONTACT_FIELDS,
  PROVIDER_FIELDS,
  VACCINATION_FIELDS,
  VITAL_FIELDS,
  VITAL_LABELS,
  VITAL_TYPES,
  formatVital,
  validateCondition,
  vitalTransform,
} from "./config";
import { RecordListSection } from "./RecordListSection";

/** Shared CRUD wiring for the health-info collections of the active profile. */
function useHealthInfo<K extends HealthInfoKind>(kind: K) {
  const { profileId, can } = useActiveProfile();
  const query = useHealthInfoListQuery({ kind, profile: profileId });
  const [create] = useCreateHealthInfoMutation();
  const [update] = useUpdateHealthInfoMutation();
  const [remove] = useDeleteHealthInfoMutation();
  return {
    items: query.data?.results as HealthInfoMap[K][] | undefined,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    canManage: can("MANAGE_PROFILE"),
    onCreate: (body: Record<string, unknown>) =>
      create({ kind, body, profile: profileId }).unwrap(),
    onUpdate: (id: string, body: Record<string, unknown>) => update({ kind, id, body }).unwrap(),
    onDelete: (id: string) => remove({ kind, id }).unwrap(),
  };
}

const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ");

function AllergiesTab() {
  const crud = useHealthInfo("allergies");
  return (
    <RecordListSection<Allergy>
      noun="allergy"
      {...crud}
      fields={ALLERGY_FIELDS}
      defaults={{ severity: "UNKNOWN" }}
      emptyIcon={AlertCircle}
      emptyTitle="No allergies recorded"
      emptyDescription="Keep track of substances that cause reactions so they're on hand at appointments."
      summarize={(a) => ({
        name: a.substance,
        title: (
          <>
            {a.substance}
            {a.severity && a.severity !== "UNKNOWN" && (
              <Badge tone="neutral">{humanize(a.severity)}</Badge>
            )}
          </>
        ),
        details: a.reaction ? `Reaction: ${a.reaction}` : undefined,
        meta: join(a.noted_on ? `Noted ${formatDate(a.noted_on)}` : null, a.notes),
      })}
    />
  );
}

function ConditionsTab() {
  const crud = useHealthInfo("conditions");
  return (
    <RecordListSection<MedicalCondition>
      noun="condition"
      {...crud}
      fields={CONDITION_FIELDS}
      defaults={{ status: "ACTIVE" }}
      validate={validateCondition}
      emptyIcon={Stethoscope}
      emptyTitle="No conditions recorded"
      emptyDescription="Add conditions you've been diagnosed with to keep your history in one place."
      summarize={(c) => ({
        name: c.name,
        title: (
          <>
            {c.name}
            <Badge tone={c.status === "RESOLVED" ? "neutral" : "info"}>
              {humanize(c.status ?? "ACTIVE")}
            </Badge>
          </>
        ),
        details: c.notes || undefined,
        meta: join(
          c.diagnosed_on ? `Diagnosed ${formatDate(c.diagnosed_on)}` : null,
          c.resolved_on ? `Resolved ${formatDate(c.resolved_on)}` : null,
        ),
      })}
    />
  );
}

/** Most recent reading of each vital type — shown as-is, without interpretation. */
export function latestVitals(vitals: VitalRecord[]): VitalRecord[] {
  const latest = new Map<string, VitalRecord>();
  for (const vital of vitals) {
    const current = latest.get(vital.vital_type);
    if (!current || new Date(vital.measured_at) > new Date(current.measured_at))
      latest.set(vital.vital_type, vital);
  }
  return VITAL_TYPES.map((t) => latest.get(t)).filter((v): v is VitalRecord => v !== undefined);
}

export function LatestVitals({ vitals }: { vitals: VitalRecord[] }) {
  const latest = useMemo(() => latestVitals(vitals), [vitals]);
  if (!latest.length) return null;
  return (
    <section aria-labelledby="latest-vitals" className="mb-4">
      <h3 id="latest-vitals" className="mb-2 text-sm font-semibold text-slate-700">
        Latest readings
      </h3>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {latest.map((v) => (
          <li key={v.vital_type} className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs text-slate-500">{VITAL_LABELS[v.vital_type]}</p>
            <p className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">
              {formatVital(v)}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(v.measured_at)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function VitalsTab() {
  const crud = useHealthInfo("vitals");
  return (
    <RecordListSection<VitalRecord>
      noun="reading"
      {...crud}
      fields={VITAL_FIELDS}
      defaults={{
        vital_type: "BLOOD_PRESSURE",
        unit: "mmHg",
        measured_at: isoToLocalInput(new Date().toISOString()),
      }}
      transform={vitalTransform}
      header={crud.items ? <LatestVitals vitals={crud.items} /> : null}
      emptyIcon={Activity}
      emptyTitle="No readings yet"
      emptyDescription="Log blood pressure, weight, temperature and other measurements to see them over time."
      summarize={(v) => ({
        name: `${VITAL_LABELS[v.vital_type]} reading`,
        title: (
          <>
            <span>{VITAL_LABELS[v.vital_type]}</span>
            <span className="font-semibold tabular-nums">{formatVital(v)}</span>
          </>
        ),
        details: v.notes || undefined,
        meta: formatDateTime(v.measured_at),
      })}
    />
  );
}

function VaccinationsTab() {
  const crud = useHealthInfo("vaccinations");
  return (
    <RecordListSection<VaccinationRecord>
      noun="vaccination"
      {...crud}
      fields={VACCINATION_FIELDS}
      emptyIcon={Syringe}
      emptyTitle="No vaccinations recorded"
      emptyDescription="Keep a record of vaccines and upcoming doses."
      summarize={(v) => ({
        name: v.vaccine_name,
        title: (
          <>
            {v.vaccine_name}
            {v.dose_number ? <Badge tone="neutral">Dose {v.dose_number}</Badge> : null}
          </>
        ),
        details: join(
          `Given ${formatDate(v.administered_on)}`,
          v.administered_by,
          v.lot_number ? `Lot ${v.lot_number}` : null,
        ),
        meta: join(
          v.next_dose_due ? `Next dose due ${formatDate(v.next_dose_due)}` : null,
          v.notes,
        ),
      })}
    />
  );
}

function ContactsTab() {
  const crud = useHealthInfo("emergency-contacts");
  return (
    <RecordListSection<EmergencyContact>
      noun="contact"
      {...crud}
      fields={CONTACT_FIELDS}
      emptyIcon={Phone}
      emptyTitle="No emergency contacts"
      emptyDescription="Add people who should be contacted in an emergency."
      summarize={(c) => ({
        name: c.name,
        title: (
          <>
            {c.name}
            {c.is_primary && <Badge tone="brand">Primary</Badge>}
          </>
        ),
        details: (
          <>
            {join(c.relationship)}
            {c.relationship && " · "}
            <a className="text-brand-700 hover:underline" href={`tel:${c.phone}`}>
              {c.phone}
            </a>
            {c.email && (
              <>
                {" · "}
                <a className="text-brand-700 hover:underline" href={`mailto:${c.email}`}>
                  {c.email}
                </a>
              </>
            )}
          </>
        ),
      })}
    />
  );
}

function ProvidersTab() {
  const { profileId, can } = useActiveProfile();
  const query = useProvidersQuery({ profile: profileId });
  const [create] = useCreateProviderMutation();
  const [update] = useUpdateProviderMutation();
  const [remove] = useDeleteProviderMutation();
  return (
    <RecordListSection<CareProvider>
      noun="provider"
      items={query.data?.results}
      isLoading={query.isLoading}
      error={query.error}
      refetch={query.refetch}
      canManage={can("MANAGE_PROFILE")}
      fields={PROVIDER_FIELDS}
      defaults={{ kind: "DOCTOR" }}
      onCreate={(body) =>
        create({ ...(body as Req<"CareProviderRequest">), profile: profileId }).unwrap()
      }
      onUpdate={(id, body) =>
        update({ id, ...(body as Req<"PatchedCareProviderRequest">) }).unwrap()
      }
      onDelete={(id) => remove(id).unwrap()}
      emptyIcon={HeartPulse}
      emptyTitle="No care providers"
      emptyDescription="Save doctors, clinics, labs and pharmacies to link them to appointments and records."
      summarize={(p) => ({
        name: p.name,
        title: (
          <>
            {p.name}
            {p.kind && <Badge tone="neutral">{humanize(p.kind)}</Badge>}
          </>
        ),
        details: join(p.specialty, p.organization) || undefined,
        meta: join(p.phone, p.email, p.address) || undefined,
      })}
    />
  );
}

const TABS = [
  { id: "allergies", label: "Allergies" },
  { id: "conditions", label: "Conditions" },
  { id: "vitals", label: "Vitals" },
  { id: "vaccinations", label: "Vaccinations" },
  { id: "contacts", label: "Emergency contacts" },
  { id: "providers", label: "Care providers" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function HealthInfoTabs() {
  const [tab, setTab] = useState<TabId>("allergies");
  return (
    <Card>
      <CardBody>
        <Tabs
          label="Health information"
          items={TABS.map((t) => ({ id: t.id, label: t.label }))}
          value={tab}
          onChange={(id) => setTab(id as TabId)}
        >
          {tab === "allergies" && <AllergiesTab />}
          {tab === "conditions" && <ConditionsTab />}
          {tab === "vitals" && <VitalsTab />}
          {tab === "vaccinations" && <VaccinationsTab />}
          {tab === "contacts" && <ContactsTab />}
          {tab === "providers" && <ProvidersTab />}
        </Tabs>
      </CardBody>
    </Card>
  );
}
