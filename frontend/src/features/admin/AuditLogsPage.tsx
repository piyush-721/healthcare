"use client";

import { ScrollText } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import {
  Card,
  EmptyState,
  Field,
  Input,
  LoadingState,
  PageHeader,
  Pagination,
  QueryState,
  Select,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/ui";
import { formatDateTime, humanize } from "@/lib/format";
import { useAuditEventTypesQuery, useAuditLogsQuery } from "@/services/admin";
import type { AdminAuditEntry } from "@/types/api";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";

import { MetadataCell } from "./badges";

/** Inclusive local-day bounds for the date-range filter. */
export function dayStart(date: string): string | undefined {
  return date ? new Date(`${date}T00:00:00`).toISOString() : undefined;
}
export function dayEnd(date: string): string | undefined {
  return date ? new Date(`${date}T23:59:59.999`).toISOString() : undefined;
}

export function AuditTable({
  entries,
  showSubject = true,
}: {
  entries: AdminAuditEntry[];
  showSubject?: boolean;
}) {
  return (
    <Table caption="Audit events">
      <THead>
        <tr>
          <Th>Time</Th>
          <Th>Event</Th>
          <Th>Actor</Th>
          {showSubject && <Th>Subject</Th>}
          <Th>Target</Th>
          <Th>IP</Th>
          <Th>Request ID</Th>
          <Th>Metadata</Th>
        </tr>
      </THead>
      <TBody>
        {entries.map((entry) => (
          <Tr key={entry.id}>
            <Td className="whitespace-nowrap">
              <time dateTime={entry.created_at}>{formatDateTime(entry.created_at)}</time>
            </Td>
            <Td className="font-medium whitespace-nowrap text-slate-900">
              {humanize(entry.event_type)}
            </Td>
            <Td>{entry.actor_email || "—"}</Td>
            {showSubject && <Td>{entry.subject_email || "—"}</Td>}
            <Td className="text-xs">
              {entry.target_type ? (
                <>
                  <span className="block">{entry.target_type}</span>
                  <span className="block font-mono break-all text-slate-500">
                    {entry.target_id}
                  </span>
                </>
              ) : (
                "—"
              )}
            </Td>
            <Td className="font-mono text-xs whitespace-nowrap">{entry.ip_address || "—"}</Td>
            <Td className="max-w-[10rem] font-mono text-xs break-all">{entry.request_id || "—"}</Td>
            <Td>
              <MetadataCell metadata={entry.metadata} />
            </Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}

function AuditContent() {
  const params = useSearchParams();
  const [eventType, setEventType] = useState(() => params.get("event_type") ?? "");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search.trim(), 300);
  const types = useAuditEventTypesQuery();
  const rangeInvalid = Boolean(from && to && from > to);
  const query = useAuditLogsQuery(
    {
      page,
      event_type: eventType || undefined,
      search: debounced || undefined,
      created_at__gte: dayStart(from),
      created_at__lte: dayEnd(to),
    },
    { skip: rangeInvalid },
  );
  const reset =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setPage(1);
    };

  return (
    <>
      <PageHeader
        title="Audit logs"
        description="Security and access events. Entries record metadata only — never health information."
      />
      <Card>
        <div className="grid gap-3 border-b border-slate-100 px-4 py-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-5">
          <Field label="Event type">
            <Select
              value={eventType}
              onChange={(e) => reset(setEventType)(e.target.value)}
              options={types.data ?? []}
              placeholder="All events"
            />
          </Field>
          <Field label="Search" className="lg:col-span-2">
            <Input
              type="search"
              value={search}
              onChange={(e) => reset(setSearch)(e.target.value)}
              placeholder="Email, target ID or request ID…"
            />
          </Field>
          <Field label="From">
            <Input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => reset(setFrom)(e.target.value)}
            />
          </Field>
          <Field label="To" error={rangeInvalid ? "Must be on or after the From date." : undefined}>
            <Input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => reset(setTo)(e.target.value)}
            />
          </Field>
        </div>
        {rangeInvalid ? (
          <EmptyState
            icon={ScrollText}
            title="Check the date range"
            description="The From date must be on or before the To date."
          />
        ) : (
          <QueryState
            query={query}
            isEmpty={(d) => d.results.length === 0}
            empty={
              <EmptyState
                icon={ScrollText}
                title="No audit events"
                description="No events match these filters."
              />
            }
          >
            {(data) => (
              <>
                <AuditTable entries={data.results} />
                <Pagination page={page} count={data.count} onChange={setPage} />
              </>
            )}
          </QueryState>
        )}
      </Card>
    </>
  );
}

export function AuditLogsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AuditContent />
    </Suspense>
  );
}
