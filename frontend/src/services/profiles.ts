import { api, cleanParams } from "@/lib/api/baseApi";
import type {
  Allergy,
  CareProvider,
  EmergencyContact,
  MedicalCondition,
  Paginated,
  PatientProfile,
  VaccinationRecord,
  VitalRecord,
} from "@/types/api";

import type { ListArgs, ProfileArg, Req } from "./types";

/** Generic CRUD for the small profile-scoped health-info collections. */
type HealthInfoKind = "allergies" | "conditions" | "emergency-contacts" | "vitals" | "vaccinations";
type HealthInfoMap = {
  allergies: Allergy;
  conditions: MedicalCondition;
  "emergency-contacts": EmergencyContact;
  vitals: VitalRecord;
  vaccinations: VaccinationRecord;
};

export const profilesApi = api.injectEndpoints({
  endpoints: (build) => ({
    profiles: build.query<PatientProfile[], void>({
      query: () => "/profiles/",
      providesTags: ["Profiles"],
    }),
    profile: build.query<PatientProfile, string>({
      query: (id) => `/profiles/${id}/`,
      providesTags: (_r, _e, id) => [{ type: "Profiles", id }],
    }),
    myProfile: build.query<PatientProfile, void>({
      query: () => "/profile/",
      providesTags: ["Profiles"],
    }),
    updateProfile: build.mutation<
      PatientProfile,
      { id: string } & Req<"PatchedPatientProfileRequest">
    >({
      query: ({ id, ...body }) => ({ url: `/profiles/${id}/`, method: "PATCH", body }),
      invalidatesTags: ["Profiles", "Dashboard", "Family"],
    }),
    deleteProfile: build.mutation<void, string>({
      query: (id) => ({ url: `/profiles/${id}/`, method: "DELETE" }),
      invalidatesTags: ["Profiles", "Family", "Dashboard"],
    }),

    healthInfoList: build.query<
      Paginated<HealthInfoMap[HealthInfoKind]>,
      { kind: HealthInfoKind } & ListArgs
    >({
      query: ({ kind, ...params }) => ({
        url: `/${kind}/`,
        params: cleanParams({ page_size: 100, ...params }),
      }),
      providesTags: (_r, _e, { kind }) => [{ type: "HealthInfo", id: kind }],
    }),
    createHealthInfo: build.mutation<
      HealthInfoMap[HealthInfoKind],
      { kind: HealthInfoKind; body: Record<string, unknown> } & ProfileArg
    >({
      query: ({ kind, body, profile }) => ({
        url: `/${kind}/`,
        method: "POST",
        body: { ...body, ...(profile ? { profile } : {}) },
      }),
      invalidatesTags: (_r, _e, { kind }) => [{ type: "HealthInfo", id: kind }, "Timeline"],
    }),
    updateHealthInfo: build.mutation<
      HealthInfoMap[HealthInfoKind],
      { kind: HealthInfoKind; id: string; body: Record<string, unknown> }
    >({
      query: ({ kind, id, body }) => ({ url: `/${kind}/${id}/`, method: "PATCH", body }),
      invalidatesTags: (_r, _e, { kind }) => [{ type: "HealthInfo", id: kind }, "Timeline"],
    }),
    deleteHealthInfo: build.mutation<void, { kind: HealthInfoKind; id: string }>({
      query: ({ kind, id }) => ({ url: `/${kind}/${id}/`, method: "DELETE" }),
      invalidatesTags: (_r, _e, { kind }) => [{ type: "HealthInfo", id: kind }, "Timeline"],
    }),

    providers: build.query<Paginated<CareProvider>, ListArgs>({
      query: (params) => ({
        url: "/providers/",
        params: cleanParams({ page_size: 100, ...params }),
      }),
      providesTags: ["Providers"],
    }),
    createProvider: build.mutation<CareProvider, Req<"CareProviderRequest"> & ProfileArg>({
      query: (body) => ({ url: "/providers/", method: "POST", body }),
      invalidatesTags: ["Providers"],
    }),
    updateProvider: build.mutation<
      CareProvider,
      { id: string } & Req<"PatchedCareProviderRequest">
    >({
      query: ({ id, ...body }) => ({ url: `/providers/${id}/`, method: "PATCH", body }),
      invalidatesTags: ["Providers"],
    }),
    deleteProvider: build.mutation<void, string>({
      query: (id) => ({ url: `/providers/${id}/`, method: "DELETE" }),
      invalidatesTags: ["Providers"],
    }),
  }),
});

export type { HealthInfoKind, HealthInfoMap };

export const {
  useProfilesQuery,
  useProfileQuery,
  useMyProfileQuery,
  useUpdateProfileMutation,
  useDeleteProfileMutation,
  useHealthInfoListQuery,
  useCreateHealthInfoMutation,
  useUpdateHealthInfoMutation,
  useDeleteHealthInfoMutation,
  useProvidersQuery,
  useCreateProviderMutation,
  useUpdateProviderMutation,
  useDeleteProviderMutation,
} = profilesApi;
