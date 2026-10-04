"use client";

import { useSyncProfileFromUrl } from "@/hooks/useSyncProfileFromUrl";

export function ProfileUrlSync() {
  useSyncProfileFromUrl();
  return null;
}
