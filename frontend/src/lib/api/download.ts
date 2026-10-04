import type { AppStore } from "@/store";

import { refreshAccessToken } from "./baseApi";

let storeRef: AppStore | null = null;

export function registerStoreForDownloads(store: AppStore) {
  storeRef = store;
}

/**
 * Download a protected file. Files are streamed through the authorized API
 * (never public URLs) and handed to the browser as a short-lived object URL.
 */
export async function downloadProtectedFile(
  url: string,
  filename: string,
  extraHeaders: Record<string, string> = {},
): Promise<void> {
  const headers = new Headers(extraHeaders);
  const token = storeRef?.getState().auth.accessToken;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let response = await fetch(url, { headers, credentials: "same-origin", cache: "no-store" });
  if (response.status === 401 && token) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers.set("Authorization", `Bearer ${refreshed.access_token}`);
      response = await fetch(url, { headers, credentials: "same-origin", cache: "no-store" });
    }
  }
  if (!response.ok) {
    let message = "The file could not be downloaded.";
    try {
      const body: unknown = await response.json();
      if (body && typeof body === "object" && "error" in body) {
        const err = (body as { error: { message?: string } }).error;
        if (err.message) message = err.message;
      }
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}
