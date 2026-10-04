import type { MedicalDocument, MedicalRecord } from "@/types/api";

export const RECORD_TYPES = [
  "CONSULTATION",
  "PRESCRIPTION",
  "LAB_REPORT",
  "DISCHARGE_SUMMARY",
  "IMAGING",
  "VACCINATION",
  "PROCEDURE",
  "OTHER",
] as const satisfies readonly MedicalRecord["record_type"][];

export const DOCUMENT_TYPES = [
  "PRESCRIPTION",
  "LAB_REPORT",
  "DISCHARGE_SUMMARY",
  "MEDICAL_BILL",
  "VACCINATION",
  "SCAN_REPORT",
  "OTHER",
] as const satisfies readonly MedicalDocument["document_type"][];

export type RecordType = (typeof RECORD_TYPES)[number];
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const MAX_UPLOAD_MB = 15;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
export const ACCEPTED_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg", ".webp"] as const;
export const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
export const ACCEPT_ATTRIBUTE = ACCEPTED_EXTENSIONS.join(",");

/** Client-side check before upload. The server re-validates type, size and content. */
export function validateUploadFile(file: File): string | null {
  const name = file.name.toLowerCase();
  const extOk = ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
  const mimeOk = !file.type || (ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type);
  if (!extOk || !mimeOk) {
    return "This file type isn't supported. Upload a PDF, PNG, JPG or WEBP file.";
  }
  if (file.size === 0) return "This file is empty. Choose another file.";
  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return `This file is ${mb} MB. The maximum size is ${MAX_UPLOAD_MB} MB.`;
  }
  return null;
}

/** "lab-report_march.pdf" → "lab report march" */
export function titleFromFilename(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}
