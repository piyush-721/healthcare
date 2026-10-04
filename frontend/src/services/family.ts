import { api } from "@/lib/api/baseApi";
import type { CaregiverAccess, FamilyOverview, PatientProfile } from "@/types/api";

import type { Req } from "./types";

export const familyApi = api.injectEndpoints({
  endpoints: (build) => ({
    family: build.query<FamilyOverview, void>({
      query: () => "/family/",
      providesTags: ["Family"],
    }),
    addDependent: build.mutation<PatientProfile, Req<"DependentProfileCreateRequest">>({
      query: (body) => ({ url: "/family/", method: "POST", body }),
      invalidatesTags: ["Family", "Profiles", "Dashboard"],
    }),
    inviteCaregiver: build.mutation<CaregiverAccess, Req<"CaregiverInviteRequest">>({
      query: (body) => ({ url: "/family/caregivers/", method: "POST", body }),
      invalidatesTags: ["Family"],
    }),
    updateCaregiver: build.mutation<
      CaregiverAccess,
      { id: string } & Req<"PatchedCaregiverUpdateRequest">
    >({
      query: ({ id, ...body }) => ({ url: `/family/caregivers/${id}/`, method: "PATCH", body }),
      invalidatesTags: ["Family"],
    }),
    revokeCaregiver: build.mutation<CaregiverAccess, string>({
      query: (id) => ({ url: `/family/caregivers/${id}/revoke/`, method: "POST" }),
      invalidatesTags: ["Family"],
    }),
    invitations: build.query<CaregiverAccess[], void>({
      query: () => "/family/invitations/",
      providesTags: ["Family"],
    }),
    respondToInvitation: build.mutation<CaregiverAccess, { id: string; accept: boolean }>({
      query: ({ id, accept }) => ({
        url: `/family/invitations/${id}/${accept ? "accept" : "decline"}/`,
        method: "POST",
      }),
      invalidatesTags: ["Family", "Profiles", "Notifications"],
    }),
    leaveCaregiving: build.mutation<void, string>({
      query: (id) => ({ url: `/family/caring-for/${id}/leave/`, method: "POST" }),
      invalidatesTags: ["Family", "Profiles"],
    }),
  }),
});

export const {
  useFamilyQuery,
  useAddDependentMutation,
  useInviteCaregiverMutation,
  useUpdateCaregiverMutation,
  useRevokeCaregiverMutation,
  useInvitationsQuery,
  useRespondToInvitationMutation,
  useLeaveCaregivingMutation,
} = familyApi;
