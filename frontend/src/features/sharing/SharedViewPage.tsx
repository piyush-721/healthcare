"use client";

import { Eye, Link2Off, Lock, ShieldCheck } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Logo } from "@/components/layout/Logo";
import {
  Alert,
  Card,
  CardBody,
  DetailList,
  EmptyState,
  ErrorState,
  LoadingState,
  Tabs,
} from "@/components/ui";
import { useUrlToken } from "@/hooks/useUrlToken";
import { parseApiError } from "@/lib/api/errors";
import { formatDateTime, formatRelative } from "@/lib/format";
import { useSharedSectionQuery, useSharedSummaryQuery } from "@/services/sharing";
import type { SharedSection, ShareSummary } from "@/types/api";

import {
  AppointmentsSection,
  DocumentsSection,
  LabResultsSection,
  MedicationsSection,
  ProfileSection,
  TreatmentPlansSection,
} from "./SharedSections";

type SectionDef = { id: SharedSection; label: string };

/** Map the share's scopes to the sections the recipient can open. */
export function sectionsForScopes(scopes: string[]): SectionDef[] {
  const has = (s: string) => scopes.includes(s);
  const sections: SectionDef[] = [];
  if (has("PROFILE")) sections.push({ id: "profile", label: "Health profile" });
  if (has("MEDICATIONS")) sections.push({ id: "medications", label: "Medications" });
  if (has("APPOINTMENTS")) sections.push({ id: "appointments", label: "Appointments" });
  if (has("DOCUMENTS") || has("FINANCIAL")) {
    const label =
      has("DOCUMENTS") && has("FINANCIAL")
        ? "Documents & bills"
        : has("DOCUMENTS")
          ? "Documents"
          : "Medical bills";
    sections.push({ id: "documents", label });
  }
  if (has("LAB_RESULTS")) sections.push({ id: "lab-results", label: "Lab results" });
  if (has("TREATMENT_PLANS")) sections.push({ id: "treatment-plans", label: "Treatment plans" });
  return sections;
}

/** Recipient-facing messages for share errors; null means "not a share error". */
export function shareErrorMessage(error: unknown): { title: string; description: string } | null {
  const code = parseApiError(error)?.code;
  if (code === "SHARE_EXPIRED")
    return {
      title: "Access denied — This sharing permission has expired.",
      description: "Ask the patient to send you a new link if you still need access.",
    };
  if (code === "SHARE_REVOKED")
    return {
      title: "Access denied — This sharing permission has been revoked.",
      description: "The patient has withdrawn access to this information.",
    };
  if (code === "SHARE_NOT_FOUND")
    return {
      title: "This link isn't valid",
      description:
        "Check that you opened the complete link you were sent, or ask the patient for a new one.",
    };
  if (code === "SHARE_SCOPE_DENIED")
    return {
      title: "Not shared",
      description: "This information isn't included in what was shared with you.",
    };
  return null;
}

function Denied({
  title,
  description,
  icon = Lock,
}: {
  title: string;
  description: string;
  icon?: typeof Lock;
}) {
  return (
    <>
      <h1 className="sr-only">Shared health information</h1>
      <Card>
        <EmptyState icon={icon} title={title} description={description} />
      </Card>
    </>
  );
}

function SectionPanel({ token, section }: { token: string; section: SharedSection }) {
  const query = useSharedSectionQuery({ token, section });
  if (query.isLoading) return <LoadingState />;
  if (query.error) {
    const message = shareErrorMessage(query.error);
    return message ? (
      <EmptyState icon={Lock} title={message.title} description={message.description} />
    ) : (
      <ErrorState error={query.error} onRetry={query.refetch} />
    );
  }
  const data = query.data ?? {};
  switch (section) {
    case "profile":
      return <ProfileSection data={data} />;
    case "medications":
      return <MedicationsSection data={data} />;
    case "appointments":
      return <AppointmentsSection data={data} />;
    case "documents":
      return <DocumentsSection data={data} token={token} />;
    case "lab-results":
      return <LabResultsSection data={data} />;
    case "treatment-plans":
      return <TreatmentPlansSection data={data} />;
  }
}

function SharedContent({ token, summary }: { token: string; summary: ShareSummary }) {
  const sections = sectionsForScopes(summary.scopes);
  const [tab, setTab] = useState<SharedSection | undefined>(sections[0]?.id);
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Health information for</p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {summary.patient_name}
        </h1>
      </div>
      <Alert tone="info" title="Read-only view">
        This information was provided by the patient and is shown as they recorded it. Your access
        is logged and the patient can see when this link is used.
      </Alert>
      <Card>
        <CardBody>
          <DetailList
            items={[
              { label: "Shared by", value: summary.shared_by },
              { label: "Shared with", value: summary.recipient_name },
              { label: "Purpose", value: summary.purpose },
              {
                label: "Access expires",
                value: `${formatDateTime(summary.expires_at)} (${formatRelative(summary.expires_at)})`,
              },
            ]}
          />
        </CardBody>
      </Card>
      {sections.length && tab ? (
        <Card>
          <CardBody>
            <Tabs
              label="Shared information"
              items={sections.map((s) => ({ id: s.id, label: s.label }))}
              value={tab}
              onChange={(id) => setTab(id as SharedSection)}
            >
              <SectionPanel key={tab} token={token} section={tab} />
            </Tabs>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <EmptyState
            icon={Eye}
            title="Nothing to show"
            description="No sections were included in this share."
          />
        </Card>
      )}
    </div>
  );
}

function SharedBody({ token }: { token: string }) {
  const summary = useSharedSummaryQuery(token);
  if (summary.isLoading) return <LoadingState label="Checking your access…" />;
  if (summary.error) {
    const message = shareErrorMessage(summary.error);
    if (message) return <Denied title={message.title} description={message.description} />;
    return (
      <Card>
        <ErrorState error={summary.error} onRetry={summary.refetch} />
      </Card>
    );
  }
  if (!summary.data) return <LoadingState />;
  return <SharedContent token={token} summary={summary.data} />;
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-canvas flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Logo />
          <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <ShieldCheck className="text-brand-700 size-4" aria-hidden />
            Secure shared access
          </span>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
      <footer className="px-4 pb-6 text-center text-xs text-slate-500">
        HealthOS organizes health information shared by patients. It does not provide medical advice
        or interpret results.
      </footer>
    </div>
  );
}

/** Public recipient page. The share token comes from the URL fragment and is held only in memory. */
export function SharedViewPage() {
  const { token, ready } = useUrlToken();
  return (
    <Shell>
      {!ready ? (
        <LoadingState />
      ) : !token ? (
        <Denied
          icon={Link2Off}
          title="This link isn't valid"
          description="The link is incomplete or missing its access code. Open the full link you were sent, or ask the patient for a new one."
        />
      ) : (
        <SharedBody token={token} />
      )}
    </Shell>
  );
}
