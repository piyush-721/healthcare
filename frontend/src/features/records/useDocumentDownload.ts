"use client";

import { useCallback, useState } from "react";

import { useToast } from "@/hooks/useToast";
import { downloadProtectedFile } from "@/lib/api/download";
import { documentDownloadUrl } from "@/services/records";
import type { MedicalDocument } from "@/types/api";

/** Download a document through the authorized API, with a toast on failure. */
export function useDocumentDownload() {
  const toast = useToast();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const download = useCallback(
    async (document: Pick<MedicalDocument, "id" | "original_filename">) => {
      setDownloadingId(document.id);
      try {
        await downloadProtectedFile(documentDownloadUrl(document.id), document.original_filename);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "The file could not be downloaded.");
      } finally {
        setDownloadingId(null);
      }
    },
    [toast],
  );

  return { download, downloadingId };
}
