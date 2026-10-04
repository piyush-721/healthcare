"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";

import { Button, Dialog, Field, FormActions, Input, Select, toOptions } from "@/components/ui";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useToast } from "@/hooks/useToast";
import { formatBytes } from "@/lib/format";
import { useRecordsQuery, useUploadDocumentMutation } from "@/services/records";
import type { MedicalDocument } from "@/types/api";

import {
  ACCEPT_ATTRIBUTE,
  DOCUMENT_TYPES,
  MAX_UPLOAD_MB,
  titleFromFilename,
  validateUploadFile,
  type DocumentType,
} from "./constants";
import { splitFormErrors } from "./formErrors";

const FIELDS = ["file", "title", "document_type", "document_date", "record"] as const;

export function DocumentUploadDialog({
  open,
  onClose,
  defaultRecordId,
  onUploaded,
}: {
  open: boolean;
  onClose: () => void;
  /** Pre-select (and lock) the record this document belongs to. */
  defaultRecordId?: string;
  onUploaded?: (document: MedicalDocument) => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Upload document"
      description={`PDF, PNG, JPG or WEBP up to ${MAX_UPLOAD_MB} MB. Every file is scanned before it can be opened.`}
      size="lg"
    >
      {open && (
        <UploadForm onClose={onClose} defaultRecordId={defaultRecordId} onUploaded={onUploaded} />
      )}
    </Dialog>
  );
}

function UploadForm({
  onClose,
  defaultRecordId,
  onUploaded,
}: {
  onClose: () => void;
  defaultRecordId?: string;
  onUploaded?: (document: MedicalDocument) => void;
}) {
  const { profileId } = useActiveProfile();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState<DocumentType>("OTHER");
  const [documentDate, setDocumentDate] = useState("");
  const [record, setRecord] = useState(defaultRecordId ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [upload, { isLoading }] = useUploadDocumentMutation();
  const { data: records } = useRecordsQuery(
    { profile: profileId, page_size: 100 },
    { skip: Boolean(defaultRecordId) },
  );

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0] ?? null;
    if (!picked) {
      setFile(null);
      return;
    }
    const problem = validateUploadFile(picked);
    if (problem) {
      setFile(null);
      setErrors((e) => ({ ...e, file: problem }));
      event.target.value = "";
      return;
    }
    setFile(picked);
    setErrors((current) => {
      const next = { ...current };
      delete next.file;
      return next;
    });
    if (!title.trim()) setTitle(titleFromFilename(picked.name));
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const local: Record<string, string> = {};
    if (!file) local.file = errors.file ?? "Choose a file to upload.";
    else {
      const problem = validateUploadFile(file);
      if (problem) local.file = problem;
    }
    if (!title.trim()) local.title = "Enter a title.";
    setErrors(local);
    if (Object.keys(local).length || !file) return;

    const body = new FormData();
    body.append("file", file);
    body.append("title", title.trim());
    body.append("document_type", documentType);
    if (documentDate) body.append("document_date", documentDate);
    if (record) body.append("record", record);
    if (profileId) body.append("profile", profileId);
    try {
      const created = await upload(body).unwrap();
      toast.success("Document uploaded. It will be available once the security scan finishes.");
      onUploaded?.(created);
      onClose();
    } catch (err) {
      const { fields, needsToast } = splitFormErrors(err, FIELDS);
      setErrors(fields);
      if (needsToast) toast.error(err, "The document could not be uploaded.");
    }
  };

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      <Field
        label="File"
        required
        error={errors.file}
        hint={
          file
            ? `${file.name} · ${formatBytes(file.size)}`
            : `PDF, PNG, JPG or WEBP · max ${MAX_UPLOAD_MB} MB`
        }
      >
        <Input
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          onChange={onFileChange}
          className="file:bg-brand-50 file:text-brand-800 py-2 file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1 file:text-sm file:font-medium"
        />
      </Field>
      <Field label="Title" required error={errors.title}>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Document type" required error={errors.document_type}>
          <Select
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value as DocumentType)}
            options={toOptions(DOCUMENT_TYPES)}
          />
        </Field>
        <Field label="Document date" error={errors.document_date}>
          <Input
            type="date"
            value={documentDate}
            onChange={(e) => setDocumentDate(e.target.value)}
          />
        </Field>
      </div>
      {!defaultRecordId && (
        <Field
          label="Link to a record"
          error={errors.record}
          hint="Optional — group this document with a visit or record."
        >
          <Select
            value={record}
            onChange={(e) => setRecord(e.target.value)}
            placeholder="No linked record"
            options={(records?.results ?? []).map((r) => ({ value: r.id, label: r.title }))}
          />
        </Field>
      )}
      <FormActions>
        <Button variant="secondary" onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" loading={isLoading}>
          Upload
        </Button>
      </FormActions>
    </form>
  );
}
