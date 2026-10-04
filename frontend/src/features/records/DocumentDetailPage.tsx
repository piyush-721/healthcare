"use client";

import { Archive, ArchiveRestore, Download, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  DetailList,
  PageHeader,
  QueryState,
} from "@/components/ui";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useToast } from "@/hooks/useToast";
import { formatBytes, formatDate, formatDateTime, humanize } from "@/lib/format";
import {
  recordsApi,
  useArchiveDocumentMutation,
  useDeleteDocumentMutation,
  useDocumentQuery,
} from "@/services/records";
import type { MedicalDocument } from "@/types/api";

import { DocumentEditDialog } from "./DocumentEditDialog";
import { ScanStatusBadge } from "./ScanStatusBadge";
import { useDocumentDownload } from "./useDocumentDownload";

const BACK = { href: "/records?tab=documents", label: "Documents" };

export function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const cached = recordsApi.endpoints.document.useQueryState(id);
  const pending = cached.data?.scan_status === "PENDING";
  const query = useDocumentQuery(id, { pollingInterval: pending ? 3000 : 0 });
  return (
    <QueryState
      query={query}
      loading={
        <>
          <PageHeader title="Document" back={BACK} />
          <Card>
            <CardBody>
              <p className="text-sm text-slate-500" role="status">
                Loading document…
              </p>
            </CardBody>
          </Card>
        </>
      }
    >
      {(document) => <DocumentDetail document={document} />}
    </QueryState>
  );
}

function ScanNotice({ document }: { document: MedicalDocument }) {
  switch (document.scan_status) {
    case "PENDING":
      return (
        <Alert tone="info" title="Security scan in progress">
          This file is being checked. It can be downloaded as soon as the scan finishes — this page
          updates automatically.
        </Alert>
      );
    case "INFECTED":
      return (
        <Alert tone="error" title="Blocked — threat detected">
          The security scan flagged this file, so it can&apos;t be downloaded. You can delete it and
          upload a clean copy.
        </Alert>
      );
    case "FAILED":
      return (
        <Alert tone="warning" title="Scan could not be completed">
          This file couldn&apos;t be checked, so downloads are unavailable. Try uploading it again.
        </Alert>
      );
    default:
      return null;
  }
}

function DocumentDetail({ document }: { document: MedicalDocument }) {
  const router = useRouter();
  const toast = useToast();
  const { can } = useActiveProfile();
  const canManage = can("UPLOAD_DOCUMENTS");
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [archive, { isLoading: archiving }] = useArchiveDocumentMutation();
  const [remove, { isLoading: deleting }] = useDeleteDocumentMutation();
  const { download, downloadingId } = useDocumentDownload();
  const isArchived = Boolean(document.archived_at);

  const onArchive = async () => {
    try {
      await archive({ id: document.id, restore: isArchived }).unwrap();
      toast.success(isArchived ? "Document restored." : "Document archived.");
      setArchiveOpen(false);
    } catch (err) {
      toast.error(err);
    }
  };

  const onDelete = async () => {
    try {
      await remove(document.id).unwrap();
      toast.success("Document deleted.");
      router.push("/records?tab=documents");
    } catch (err) {
      toast.error(err);
      setDeleteOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={document.title}
        back={BACK}
        badge={
          <>
            <ScanStatusBadge status={document.scan_status} />
            {isArchived && <Badge>Archived</Badge>}
          </>
        }
        description={humanize(document.document_type)}
        actions={
          <>
            <Button
              icon={<Download className="size-4" aria-hidden />}
              disabled={!document.is_available}
              loading={downloadingId === document.id}
              onClick={() => download(document)}
            >
              Download
            </Button>
            {canManage && (
              <Button
                variant="secondary"
                icon={<Pencil className="size-4" aria-hidden />}
                onClick={() => setEditOpen(true)}
              >
                Edit details
              </Button>
            )}
          </>
        }
      />
      <ScanNotice document={document} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Details" />
          <CardBody className="py-1">
            <DetailList
              items={[
                {
                  label: "File name",
                  value: <span className="break-all">{document.original_filename}</span>,
                },
                { label: "Type", value: humanize(document.document_type) },
                {
                  label: "Document date",
                  value: document.document_date ? formatDate(document.document_date) : null,
                },
                { label: "Size", value: formatBytes(document.size_bytes) },
                {
                  label: "Security scan",
                  value: <ScanStatusBadge status={document.scan_status} />,
                },
                {
                  label: "Linked record",
                  value: document.record ? (
                    <Link
                      href={`/records/${document.record}`}
                      className="text-brand-700 font-medium hover:underline"
                    >
                      {document.record_title || "View record"}
                    </Link>
                  ) : null,
                },
                { label: "Uploaded by", value: document.uploaded_by_name },
                { label: "Uploaded", value: formatDateTime(document.created_at) },
                ...(isArchived
                  ? [{ label: "Archived", value: formatDateTime(document.archived_at) }]
                  : []),
              ]}
            />
          </CardBody>
        </Card>
        {canManage && (
          <Card className="self-start">
            <CardHeader title="Manage" />
            <CardBody className="space-y-3">
              <p className="text-sm text-slate-600">
                {isArchived
                  ? "Restoring brings this document back to your active documents."
                  : "Archiving hides this document from your active list and timeline without deleting it."}
              </p>
              <Button
                variant="secondary"
                className="w-full"
                icon={
                  isArchived ? (
                    <ArchiveRestore className="size-4" aria-hidden />
                  ) : (
                    <Archive className="size-4" aria-hidden />
                  )
                }
                onClick={() => setArchiveOpen(true)}
              >
                {isArchived ? "Restore document" : "Archive document"}
              </Button>
              <Button
                variant="danger"
                className="w-full"
                icon={<Trash2 className="size-4" aria-hidden />}
                onClick={() => setDeleteOpen(true)}
              >
                Delete permanently
              </Button>
            </CardBody>
          </Card>
        )}
      </div>

      <DocumentEditDialog open={editOpen} onClose={() => setEditOpen(false)} document={document} />
      <ConfirmDialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onConfirm={onArchive}
        loading={archiving}
        tone="primary"
        title={isArchived ? "Restore this document?" : "Archive this document?"}
        confirmLabel={isArchived ? "Restore" : "Archive"}
        message={
          isArchived
            ? "The document will appear in your active documents again."
            : "The document will move to Archived. You can restore it at any time."
        }
      />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={onDelete}
        loading={deleting}
        title="Delete this document permanently?"
        confirmLabel="Delete permanently"
        message={
          <>
            <strong className="font-medium text-slate-900">{document.title}</strong> and its file
            will be permanently deleted. This can&apos;t be undone. To keep it out of sight instead,
            archive it.
          </>
        }
      />
    </div>
  );
}
