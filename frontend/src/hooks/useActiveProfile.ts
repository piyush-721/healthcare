"use client";

import { useMemo } from "react";

import { useProfilesQuery } from "@/services/profiles";
import { useAppSelector } from "@/store/hooks";
import type { PatientProfile, Permission } from "@/types/api";

export type ActiveProfile = {
  /** Profile id to send to the API (undefined → the caller's own profile). */
  profileId: string | undefined;
  profile: PatientProfile | undefined;
  profiles: PatientProfile[];
  isOwner: boolean;
  isLoading: boolean;
  can: (permission: Permission) => boolean;
};

/**
 * The profile whose health information is being viewed, plus the caller's
 * permissions on it. UI uses `can()` only to hide controls — the API enforces
 * every rule server-side.
 */
export function useActiveProfile(): ActiveProfile {
  const activeProfileId = useAppSelector((state) => state.profile.activeProfileId);
  const { data: profiles = [], isLoading } = useProfilesQuery();

  return useMemo(() => {
    const profile =
      profiles.find((p) => p.id === activeProfileId) ??
      profiles.find((p) => p.is_self) ??
      profiles[0];
    const permissions = new Set(profile?.permissions ?? []);
    return {
      profileId: profile && !profile.is_self ? profile.id : undefined,
      profile,
      profiles,
      isOwner: profile?.access_role === "OWNER",
      isLoading,
      can: (permission: Permission) => permissions.has(permission),
    };
  }, [profiles, activeProfileId, isLoading]);
}
