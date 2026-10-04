"use client";

import { useState, type FormEvent } from "react";

import { Button, Dialog, Field, FormActions, Input, Select, toOptions } from "@/components/ui";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useToast } from "@/hooks/useToast";
import { useRecordsQuery, useUpdateDocumentMutation } from "@/services/records";
import type { MedicalDocument } from "@/types/api";

import { DOCUMENT_TYPES, type DocumentType } from "./constants";
import { splitFormErrors } from "./formErrors";

const FIELDS = ["title", "document_type", "document_date", "record"] as const;

export function DocumentEditDialog({
  open,
  onClose,
  document,
}: {
  open: boolean;
  onClose: () => void;
  document: MedicalDocument;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Edit document details" size="lg">
      {open && <EditForm document={document} onClose={onClose} />}
    </Dialog>
  );
}

function EditForm({ document, onClose }: { document: MedicalDocument; onClose: () => void }) {
  const { profileId } = useActiveProfile();
  const toast = useToast();
  const [title, setTitle] = useState(document.title);
  const [documentType, setDocumentType] = useState<DocumentType>(document.document_type);
  const [documentDate, setDocumentDate] = useState(document.document_date ?? "");
  const [record, setRecord] = useState(document.record ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [update, { isLoading }] = useUpdateDocumentMutation();
  const { data: records } = useRecordsQuery({ profile: profileId, page_size: 100 });

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      setErrors({ title: "Enter a title." });
      return;
    }
    setErrors({});
    try {
      await update({
        id: document.id,
        title: title.trim(),
        document_type: documentType,
        document_date: documentDate || null,
        record: record || null,
      }).unwrap();
      toast.success("Document details updated.");
      onClose();
    } catch (err) {
      const { fields, needsToast } = splitFormErrors(err, FIELDS);
      setErrors(fields);
      if (needsToast) toast.error(err);
    }
  };

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
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
      <Field label="Linked record" error={errors.record}>
        <Select
          value={record}
          onChange={(e) => setRecord(e.target.value)}
          placeholder="No linked record"
          options={(records?.results ?? []).map((r) => ({ value: r.id, label: r.title }))}
        />
      </Field>
      <FormActions>
        <Button variant="secondary" onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" loading={isLoading}>
          Save changes
        </Button>
      </FormActions>
    </form>
  );
}
