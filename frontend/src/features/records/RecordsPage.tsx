"use client";

import { FileText, FolderOpen, Paperclip, Plus, Search, Upload } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Pagination,
  QueryState,
  Select,
  Tabs,
  toOptions,
} from "@/components/ui";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { formatBytes, formatDate, humanize } from "@/lib/format";
import { recordsApi, useDocumentsQuery, useRecordsQuery } from "@/services/records";
import type { MedicalDocument, MedicalRecord } from "@/types/api";

import { DOCUMENT_TYPES, RECORD_TYPES } from "./constants";
import { DocumentUploadDialog } from "./DocumentUploadDialog";
import { RecordFormDialog } from "./RecordFormDialog";
import { ScanStatusBadge } from "./ScanStatusBadge";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

type Tab = "records" | "documents";

export function RecordsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab: Tab = searchParams.get("tab") === "documents" ? "documents" : "records";
  const { can } = useActiveProfile();
  const canUpload = can("UPLOAD_DOCUMENTS");
  const [recordOpen, setRecordOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const setTab = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "documents") params.set("tab", "documents");
    else params.delete("tab");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Medical records"
        description="Visits, prescriptions, reports and the documents that go with them."
        actions={
          canUpload && (
            <>
              <Button
                variant="secondary"
                icon={<Upload className="size-4" aria-hidden />}
                onClick={() => setUploadOpen(true)}
              >
                Upload document
              </Button>
              <Button
                icon={<Plus className="size-4" aria-hidden />}
                onClick={() => setRecordOpen(true)}
              >
                New record
              </Button>
            </>
          )
        }
      />
      <Tabs
        label="Records and documents"
        value={tab}
        onChange={setTab}
        items={[
          { id: "records", label: "Records" },
          { id: "documents", label: "Documents" },
        ]}
      >
        {tab === "records" ? (
          <RecordsTab
            canUpload={canUpload}
            onNewRecord={() => setRecordOpen(true)}
            onUpload={() => setUploadOpen(true)}
          />
        ) : (
          <DocumentsTab canUpload={canUpload} onUpload={() => setUploadOpen(true)} />
        )}
      </Tabs>
      <RecordFormDialog open={recordOpen} onClose={() => setRecordOpen(false)} />
      <DocumentUploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  );
}

function RecordsTab({
  canUpload,
  onNewRecord,
  onUpload,
}: {
  canUpload: boolean;
  onNewRecord: () => void;
  onUpload: () => void;
}) {
  const { profileId } = useActiveProfile();
  const [search, setSearch] = useState("");
  const [recordType, setRecordType] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim());
  const query = useRecordsQuery({
    profile: profileId,
    search: debouncedSearch,
    record_type: recordType,
    page,
  });
  const filtered = Boolean(debouncedSearch || recordType);

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-end">
        <Field label="Search records" className="flex-1">
          <Input
            type="search"
            placeholder="Title, description or provider"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </Field>
        <Field label="Type" className="sm:w-56">
          <Select
            value={recordType}
            onChange={(e) => {
              setRecordType(e.target.value);
              setPage(1);
            }}
            placeholder="All types"
            options={toOptions(RECORD_TYPES)}
          />
        </Field>
      </div>
      <QueryState
        query={query}
        isEmpty={(data) => data.results.length === 0}
        empty={
          filtered ? (
            <EmptyState
              icon={Search}
              title="No matching records"
              description="Try a different search or type."
            />
          ) : (
            <EmptyState
              icon={FolderOpen}
              title="No medical records yet"
              description="Upload your first medical document to start building your health history."
              action={
                canUpload && (
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button icon={<Upload className="size-4" aria-hidden />} onClick={onUpload}>
                      Upload document
                    </Button>
                    <Button variant="secondary" onClick={onNewRecord}>
                      New record
                    </Button>
                  </div>
                )
              }
            />
          )
        }
      >
        {(data) => (
          <>
            <ul className="divide-y divide-slate-100">
              {data.results.map((record) => (
                <RecordRow key={record.id} record={record} />
              ))}
            </ul>
            <Pagination page={page} count={data.count} onChange={setPage} />
          </>
        )}
      </QueryState>
    </Card>
  );
}

function RecordRow({ record }: { record: MedicalRecord }) {
  const docCount = record.documents.length;
  return (
    <li className="relative flex items-start gap-3 px-4 py-3 hover:bg-slate-50/60 sm:px-5">
      <div className="bg-brand-50 text-brand-700 mt-0.5 rounded-lg p-2">
        <FileText className="size-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/records/${record.id}`}
            className="hover:text-brand-800 font-medium text-slate-900 after:absolute after:inset-0"
          >
            {record.title}
          </Link>
          <Badge tone="brand">{humanize(record.record_type)}</Badge>
        </div>
        <p className="mt-0.5 text-sm text-slate-500">
          {formatDate(record.record_date)}
          {record.provider_detail?.name && <> · {record.provider_detail.name}</>}
        </p>
      </div>
      <span className="flex shrink-0 items-center gap-1 text-sm text-slate-500">
        <Paperclip className="size-3.5" aria-hidden />
        {docCount}
        <span className="sr-only">{docCount === 1 ? "document" : "documents"}</span>
      </span>
    </li>
  );
}

function DocumentsTab({ canUpload, onUpload }: { canUpload: boolean; onUpload: () => void }) {
  const { profileId } = useActiveProfile();
  const [archived, setArchived] = useState(false);
  const [documentType, setDocumentType] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim());
  const args = {
    profile: profileId,
    archived,
    document_type: documentType,
    search: debouncedSearch,
    page,
  };
  // Peek at the cached page (without subscribing) to decide whether to poll for scan results.
  const cached = recordsApi.endpoints.documents.useQueryState(args);
  const anyPending = cached.data?.results.some((d) => d.scan_status === "PENDING") ?? false;
  const query = useDocumentsQuery(args, { pollingInterval: anyPending ? 3000 : 0 });
  const filtered = Boolean(debouncedSearch || documentType);

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-end">
        <div
          role="group"
          aria-label="Show documents"
          className="inline-flex self-start rounded-lg border border-slate-300 p-0.5"
        >
          {[false, true].map((value) => (
            <button
              key={String(value)}
              type="button"
              aria-pressed={archived === value}
              onClick={() => {
                setArchived(value);
                setPage(1);
              }}
              className={
                archived === value
                  ? "bg-brand-700 rounded-md px-3 py-1.5 text-sm font-medium text-white"
                  : "rounded-md px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
              }
            >
              {value ? "Archived" : "Active"}
            </button>
          ))}
        </div>
        <Field label="Search documents" className="flex-1">
          <Input
            type="search"
            placeholder="Title or file name"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </Field>
        <Field label="Type" className="lg:w-56">
          <Select
            value={documentType}
            onChange={(e) => {
              setDocumentType(e.target.value);
              setPage(1);
            }}
            placeholder="All types"
            options={toOptions(DOCUMENT_TYPES)}
          />
        </Field>
      </div>
      <QueryState
        query={query}
        isEmpty={(data) => data.results.length === 0}
        empty={
          filtered ? (
            <EmptyState
              icon={Search}
              title="No matching documents"
              description="Try a different search or type."
            />
          ) : archived ? (
            <EmptyState
              icon={FolderOpen}
              title="No archived documents"
              description="Documents you archive appear here."
            />
          ) : (
            <EmptyState
              icon={FolderOpen}
              title="No documents yet"
              description="Upload your first medical document to start building your health history."
              action={
                canUpload && (
                  <Button icon={<Upload className="size-4" aria-hidden />} onClick={onUpload}>
                    Upload document
                  </Button>
                )
              }
            />
          )
        }
      >
        {(data) => (
          <>
            <ul className="divide-y divide-slate-100">
              {data.results.map((doc) => (
                <DocumentRow key={doc.id} document={doc} />
              ))}
            </ul>
            <Pagination page={page} count={data.count} onChange={setPage} />
          </>
        )}
      </QueryState>
    </Card>
  );
}

export function DocumentRow({ document }: { document: MedicalDocument }) {
  return (
    <li className="relative flex flex-col gap-2 px-4 py-3 hover:bg-slate-50/60 sm:flex-row sm:items-center sm:px-5">
      <div className="min-w-0 flex-1">
        <Link
          href={`/records/documents/${document.id}`}
          className="hover:text-brand-800 font-medium text-slate-900 after:absolute after:inset-0"
        >
          {document.title}
        </Link>
        <p className="mt-0.5 truncate text-sm text-slate-500">
          {humanize(document.document_type)} ·{" "}
          {formatDate(document.document_date ?? document.created_at)} ·{" "}
          {formatBytes(document.size_bytes)}
          {document.record_title && <> · {document.record_title}</>}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-1.5">
        {document.archived_at && <Badge>Archived</Badge>}
        <ScanStatusBadge status={document.scan_status} />
      </div>
    </li>
  );
}
