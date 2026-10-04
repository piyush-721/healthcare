"use client";

import { ChevronRight, FlaskConical, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  Button,
  Card,
  CardHeader,
  Dialog,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Pagination,
  QueryState,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/ui";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { formatDate } from "@/lib/format";
import { useLabReportsQuery } from "@/services/labs";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";

import { LabReportForm } from "./LabReportForm";
import { LabTrendCard } from "./LabTrendCard";

function LabReportsContent({
  profileId,
  canManage,
}: {
  profileId: string | undefined;
  canManage: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const query = useLabReportsQuery({
    profile: profileId,
    search: debouncedSearch || undefined,
    page,
  });

  const addButton = canManage ? (
    <Button onClick={() => setAdding(true)} icon={<Plus className="size-4" aria-hidden />}>
      Add lab report
    </Button>
  ) : null;

  return (
    <>
      <PageHeader
        title="Lab reports"
        description="Results as printed on your reports, organized by date. HealthOS doesn't interpret results."
        actions={addButton}
      />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title="Reports"
            description={query.data ? `${query.data.count} total` : undefined}
          />
          <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
            <Field label="Search reports" hideLabel>
              <Input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by title or lab…"
              />
            </Field>
          </div>
          <QueryState
            query={query}
            isEmpty={(data) => data.results.length === 0}
            empty={
              debouncedSearch ? (
                <EmptyState
                  icon={Search}
                  title="No matching reports"
                  description={`Nothing matches “${debouncedSearch}”.`}
                />
              ) : (
                <EmptyState
                  icon={FlaskConical}
                  title="No lab reports yet"
                  description="Add the results from a lab report to keep them in one place and follow trends over time."
                  action={addButton}
                />
              )
            }
          >
            {(data) => (
              <>
                {/* Mobile: card list */}
                <ul className="divide-y divide-slate-100 sm:hidden">
                  {data.results.map((report) => (
                    <li key={report.id}>
                      <Link
                        href={`/labs/${report.id}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-slate-900">{report.title}</p>
                          <p className="text-sm text-slate-500">
                            {formatDate(report.report_date)}
                            {report.lab_name ? ` · ${report.lab_name}` : ""}
                          </p>
                          <p className="text-xs text-slate-500">
                            {report.result_count} result{report.result_count === 1 ? "" : "s"}
                          </p>
                        </div>
                        <ChevronRight className="size-4 text-slate-400" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
                {/* Desktop: table */}
                <div className="hidden sm:block">
                  <Table caption="Lab reports">
                    <THead>
                      <tr>
                        <Th>Title</Th>
                        <Th>Lab</Th>
                        <Th>Report date</Th>
                        <Th className="text-right">Results</Th>
                      </tr>
                    </THead>
                    <TBody>
                      {data.results.map((report) => (
                        <Tr key={report.id}>
                          <Td>
                            <Link
                              href={`/labs/${report.id}`}
                              className="text-brand-700 font-medium hover:underline"
                            >
                              {report.title}
                            </Link>
                          </Td>
                          <Td>{report.lab_name || "—"}</Td>
                          <Td className="whitespace-nowrap">{formatDate(report.report_date)}</Td>
                          <Td className="text-right tabular-nums">{report.result_count}</Td>
                        </Tr>
                      ))}
                    </TBody>
                  </Table>
                </div>
                <Pagination page={page} count={data.count} onChange={setPage} />
              </>
            )}
          </QueryState>
        </Card>
        <div className="lg:col-span-2">
          <LabTrendCard profileId={profileId} />
        </div>
      </div>

      <Dialog
        open={adding}
        onClose={() => setAdding(false)}
        title="Add lab report"
        description="Enter the values exactly as printed on your report."
        size="lg"
      >
        <LabReportForm
          onCancel={() => setAdding(false)}
          onSaved={(report) => {
            setAdding(false);
            router.push(`/labs/${report.id}`);
          }}
        />
      </Dialog>
    </>
  );
}

export function LabReportsPage() {
  const { profileId, can } = useActiveProfile();
  // Keyed by profile so search, page and dialogs reset when switching profiles.
  return (
    <LabReportsContent
      key={profileId ?? "self"}
      profileId={profileId}
      canManage={can("MANAGE_LAB_RESULTS")}
    />
  );
}
