"use client";

import { FileText, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { MedicalDisclaimer } from "@/components/domain/MedicalDisclaimer";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  DetailList,
  Dialog,
  EmptyState,
  PageHeader,
  QueryState,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/ui";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useToast } from "@/hooks/useToast";
import { formatDate, formatDateTime } from "@/lib/format";
import { useDeleteLabReportMutation, useLabReportQuery } from "@/services/labs";
import type { LabReport, LabResult } from "@/types/api";

import { LabReportForm } from "./LabReportForm";
import { formatRange, MachineExtractedBadge, RangeBadge, trimNumber } from "./RangeBadge";

export const RESULTS_CAPTION =
  "Ranges are those printed on your report. HealthOS doesn't interpret results — discuss them with your doctor.";

function resultValue(result: LabResult): string {
  const value =
    result.value != null && result.value !== ""
      ? trimNumber(result.value)
      : result.value_text || "—";
  return result.unit && value !== "—" ? `${value} ${result.unit}` : value;
}

export function LabResultsTable({ results }: { results: LabResult[] }) {
  if (results.length === 0) {
    return (
      <EmptyState
        title="No results recorded"
        description="This report doesn't have any results entered yet."
      />
    );
  }
  return (
    <>
      <ul className="divide-y divide-slate-100 sm:hidden">
        {results.map((result) => (
          <li key={result.id} className="space-y-1 px-4 py-3">
            <p className="font-medium text-slate-900">{result.test_name}</p>
            <p className="text-sm text-slate-700">{resultValue(result)}</p>
            <p className="text-xs text-slate-500">
              Report range:{" "}
              {formatRange(result.reference_low, result.reference_high, result.reference_text)}
            </p>
            <div className="flex flex-wrap gap-1.5">
              <RangeBadge position={result.range_position} />
              {result.source === "MACHINE_EXTRACTED" && <MachineExtractedBadge />}
            </div>
            {result.notes && <p className="text-xs text-slate-500">{result.notes}</p>}
          </li>
        ))}
      </ul>
      <div className="hidden sm:block">
        <Table caption="Lab results">
          <THead>
            <tr>
              <Th>Test</Th>
              <Th>Result</Th>
              <Th>Report range</Th>
              <Th>Position</Th>
            </tr>
          </THead>
          <TBody>
            {results.map((result) => (
              <Tr key={result.id}>
                <Td>
                  <span className="font-medium text-slate-900">{result.test_name}</span>
                  {result.notes && <p className="text-xs text-slate-500">{result.notes}</p>}
                </Td>
                <Td className="tabular-nums">{resultValue(result)}</Td>
                <Td className="tabular-nums">
                  {formatRange(result.reference_low, result.reference_high, result.reference_text)}
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1.5">
                    <RangeBadge position={result.range_position} />
                    {result.source === "MACHINE_EXTRACTED" && <MachineExtractedBadge />}
                  </div>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>
    </>
  );
}

function ReportView({ report, canManage }: { report: LabReport; canManage: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [remove, { isLoading: deleting }] = useDeleteLabReportMutation();
  const results = report.results ?? [];

  const onDelete = async () => {
    try {
      await remove(report.id).unwrap();
      toast.success("Lab report deleted.");
      router.push("/labs");
    } catch (err) {
      toast.error(err);
      setConfirmDelete(false);
    }
  };

  return (
    <>
      <PageHeader
        back={{ href: "/labs", label: "Lab reports" }}
        title={report.title}
        description={[formatDate(report.report_date), report.lab_name].filter(Boolean).join(" · ")}
        actions={
          canManage && (
            <>
              <Button
                variant="secondary"
                onClick={() => setEditing(true)}
                icon={<Pencil className="size-4" aria-hidden />}
              >
                Edit
              </Button>
              <Button
                variant="danger"
                onClick={() => setConfirmDelete(true)}
                icon={<Trash2 className="size-4" aria-hidden />}
              >
                Delete
              </Button>
            </>
          )
        }
      />
      <div className="space-y-6">
        <Card>
          <CardHeader title={`Results (${results.length})`} />
          <LabResultsTable results={results} />
          <CardBody className="border-t border-slate-100">
            <MedicalDisclaimer>{RESULTS_CAPTION}</MedicalDisclaimer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Report details" />
          <CardBody className="py-1">
            <DetailList
              items={[
                { label: "Lab", value: report.lab_name },
                { label: "Report date", value: formatDate(report.report_date) },
                { label: "Ordered by", value: report.ordered_by_detail?.name },
                {
                  label: "Document",
                  value: report.document ? (
                    <Link
                      href={`/records/documents/${report.document}`}
                      className="text-brand-700 inline-flex items-center gap-1 font-medium hover:underline"
                    >
                      <FileText className="size-4" aria-hidden />
                      {report.document_title || "View document"}
                    </Link>
                  ) : null,
                },
                {
                  label: "Notes",
                  value: report.notes ? (
                    <span className="whitespace-pre-line">{report.notes}</span>
                  ) : null,
                },
                { label: "Last updated", value: formatDateTime(report.updated_at) },
              ]}
            />
          </CardBody>
        </Card>
      </div>

      <Dialog
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit lab report"
        description="Saving replaces the results list with the rows below."
        size="lg"
      >
        <LabReportForm
          report={report}
          onCancel={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={onDelete}
        loading={deleting}
        title="Delete this lab report?"
        message={
          <>
            “{report.title}” and its {results.length} result{results.length === 1 ? "" : "s"} will
            be permanently deleted. Any attached document stays in Records.
          </>
        }
        confirmLabel="Delete report"
      />
    </>
  );
}

export function LabReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useActiveProfile();
  const query = useLabReportQuery(id);
  return (
    <QueryState query={query}>
      {(report) => <ReportView report={report} canManage={can("MANAGE_LAB_RESULTS")} />}
    </QueryState>
  );
}
