"use client";

import { Download, FolderOpen, Pencil, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  DetailList,
  EmptyState,
  PageHeader,
  QueryState,
} from "@/components/ui";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useToast } from "@/hooks/useToast";
import { formatBytes, formatDate, formatDateTime, humanize } from "@/lib/format";
import { useDeleteRecordMutation, useRecordQuery } from "@/services/records";
import type { MedicalDocument, MedicalRecord } from "@/types/api";

import { DocumentUploadDialog } from "./DocumentUploadDialog";
import { RecordFormDialog } from "./RecordFormDialog";
import { ScanStatusBadge } from "./ScanStatusBadge";
import { useDocumentDownload } from "./useDocumentDownload";

const BACK = { href: "/records", label: "Medical records" };

export function RecordDetailPage() {
  const { id } = useParams<{ id: string }>();
  const query = useRecordQuery(id);
  return (
    <QueryState
      query={query}
      loading={
        <>
          <PageHeader title="Medical record" back={BACK} />
          <Card>
            <CardBody>
              <p className="text-sm text-slate-500" role="status">
                Loading record…
              </p>
            </CardBody>
          </Card>
        </>
      }
    >
      {(record) => <RecordDetail record={record} />}
    </QueryState>
  );
}

/** The record serializer nests the full document representation (archived ones excluded). */
function recordDocuments(record: MedicalRecord): MedicalDocument[] {
  return record.documents as unknown as MedicalDocument[];
}

function RecordDetail({ record }: { record: MedicalRecord }) {
  const router = useRouter();
  const toast = useToast();
  const { can } = useActiveProfile();
  const canManage = can("UPLOAD_DOCUMENTS");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [remove, { isLoading: deleting }] = useDeleteRecordMutation();
  const { download, downloadingId } = useDocumentDownload();
  const documents = recordDocuments(record);

  const onDelete = async () => {
    try {
      await remove(record.id).unwrap();
      toast.success("Record deleted.");
      router.push("/records");
    } catch (err) {
      toast.error(err);
      setDeleteOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={record.title}
        back={BACK}
        badge={<Badge tone="brand">{humanize(record.record_type)}</Badge>}
        description={formatDate(record.record_date)}
        actions={
          canManage && (
            <>
              <Button
                variant="secondary"
                icon={<Pencil className="size-4" aria-hidden />}
                onClick={() => setEditOpen(true)}
              >
                Edit
              </Button>
              <Button
                variant="secondary"
                icon={<Trash2 className="size-4" aria-hidden />}
                onClick={() => setDeleteOpen(true)}
              >
                Delete
              </Button>
            </>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader title="Details" />
          <CardBody className="py-1">
            <DetailList
              items={[
                { label: "Type", value: humanize(record.record_type) },
                { label: "Date", value: formatDate(record.record_date) },
                {
                  label: "Provider",
                  value: record.provider_detail
                    ? [
                        record.provider_detail.name,
                        record.provider_detail.specialty || record.provider_detail.organization,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : null,
                },
                {
                  label: "Description",
                  value: record.description ? (
                    <span className="whitespace-pre-line">{record.description}</span>
                  ) : null,
                },
                { label: "Added", value: formatDateTime(record.created_at) },
              ]}
            />
          </CardBody>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader
            title="Documents"
            description={`${documents.length} ${documents.length === 1 ? "document" : "documents"}`}
            action={
              canManage && (
                <Button
                  size="sm"
                  icon={<Upload className="size-4" aria-hidden />}
                  onClick={() => setUploadOpen(true)}
                >
                  Upload document to this record
                </Button>
              )
            }
          />
          {documents.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title="No documents attached"
              description="Attach prescriptions, reports or bills to keep everything for this record together."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {documents.map((doc) => (
                <li
                  key={doc.id}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/records/documents/${doc.id}`}
                      className="hover:text-brand-800 font-medium text-slate-900 hover:underline"
                    >
                      {doc.title}
                    </Link>
                    <p className="mt-0.5 truncate text-sm text-slate-500">
                      {humanize(doc.document_type)} · {formatBytes(doc.size_bytes)} ·{" "}
                      {doc.original_filename}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <ScanStatusBadge status={doc.scan_status} />
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!doc.is_available}
                      loading={downloadingId === doc.id}
                      icon={<Download className="size-4" aria-hidden />}
                      onClick={() => download(doc)}
                      aria-label={`Download ${doc.title}`}
                    >
                      Download
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <RecordFormDialog open={editOpen} onClose={() => setEditOpen(false)} record={record} />
      <DocumentUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        defaultRecordId={record.id}
      />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={onDelete}
        loading={deleting}
        title="Delete this record?"
        confirmLabel="Delete record"
        message={
          <>
            <strong className="font-medium text-slate-900">{record.title}</strong> will be
            permanently deleted. Its documents are kept and stay available under Documents. This
            can&apos;t be undone.
          </>
        }
      />
    </div>
  );
}
