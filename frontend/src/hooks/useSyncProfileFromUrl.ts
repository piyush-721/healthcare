"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { useAppDispatch } from "@/store/hooks";
import { activeProfileChanged } from "@/store/slices/profileSlice";

/** Links from notifications carry `?profile=<id>`; switch the active profile to match. */
export function useSyncProfileFromUrl() {
  const params = useSearchParams();
  const dispatch = useAppDispatch();
  const profile = params.get("profile");
  useEffect(() => {
    if (profile) dispatch(activeProfileChanged(profile));
  }, [profile, dispatch]);
}
