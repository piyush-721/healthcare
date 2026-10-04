import { getFieldErrors } from "@/lib/api/errors";

/**
 * Split an API error into errors shown next to known form fields and a flag
 * telling the caller to toast the rest (non-field or unknown-field errors).
 */
export function splitFormErrors(
  error: unknown,
  knownFields: readonly string[],
): { fields: Record<string, string>; needsToast: boolean } {
  const all = getFieldErrors(error);
  const fields: Record<string, string> = {};
  let unmatched = false;
  for (const [key, message] of Object.entries(all)) {
    if (knownFields.includes(key)) fields[key] = message;
    else unmatched = true;
  }
  return { fields, needsToast: unmatched || Object.keys(fields).length === 0 };
}
