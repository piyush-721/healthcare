import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import type { SerializedError } from "@reduxjs/toolkit";

/** The backend's error envelope: `{ "error": { code, message, fields? } }`. */
export type ApiErrorBody = {
  code: string;
  message: string;
  fields?: Record<string, unknown>;
  retry_after_seconds?: number;
};

export type QueryError = FetchBaseQueryError | SerializedError | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseApiError(error: unknown): ApiErrorBody | null {
  if (!isRecord(error)) return null;
  const data = "data" in error ? error.data : undefined;
  if (isRecord(data) && isRecord(data.error) && typeof data.error.code === "string") {
    return data.error as ApiErrorBody;
  }
  return null;
}

export function errorStatus(error: unknown): number | null {
  if (isRecord(error) && typeof error.status === "number") return error.status;
  return null;
}

export function getErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  const parsed = parseApiError(error);
  if (parsed) {
    if (parsed.code === "VALIDATION_ERROR" && parsed.fields) {
      const nonField = parsed.fields.non_field_errors ?? parsed.fields.detail;
      if (Array.isArray(nonField) && typeof nonField[0] === "string") return nonField[0];
    }
    return parsed.message;
  }
  if (isRecord(error) && error.status === "FETCH_ERROR") {
    return "We couldn't reach HealthOS. Check your connection and try again.";
  }
  return fallback;
}

/** Flatten `{ field: ["msg"] }` into `{ field: "msg" }` for form display. */
export function getFieldErrors(error: unknown): Record<string, string> {
  const fields = parseApiError(error)?.fields;
  if (!fields) return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value) && typeof value[0] === "string") result[key] = value[0];
    else if (isRecord(value)) result[key] = "Please check this field.";
  }
  return result;
}

export function isNotFound(error: unknown): boolean {
  return errorStatus(error) === 404;
}

export function isForbidden(error: unknown): boolean {
  return errorStatus(error) === 403;
}
