import { api, cleanParams } from "@/lib/api/baseApi";
import type { Adherence, Medication, MedicationLog, Paginated, TodayDoses } from "@/types/api";

import type { ListArgs, ProfileArg, Req } from "./types";

export type MedicationAction = "pause" | "resume" | "complete" | "stop";

export const medicationsApi = api.injectEndpoints({
  endpoints: (build) => ({
    medications: build.query<Paginated<Medication>, ListArgs>({
      query: (params) => ({ url: "/medications/", params: cleanParams(params) }),
      providesTags: ["Medications"],
    }),
    medication: build.query<Medication, string>({
      query: (id) => `/medications/${id}/`,
      providesTags: (_r, _e, id) => [{ type: "Medications", id }],
    }),
    createMedication: build.mutation<Medication, Req<"MedicationRequest"> & ProfileArg>({
      query: (body) => ({ url: "/medications/", method: "POST", body }),
      invalidatesTags: ["Medications", "Doses", "Timeline", "Dashboard"],
    }),
    updateMedication: build.mutation<Medication, { id: string } & Req<"PatchedMedicationRequest">>({
      query: ({ id, ...body }) => ({ url: `/medications/${id}/`, method: "PATCH", body }),
      invalidatesTags: ["Medications", "Doses", "Timeline", "Dashboard"],
    }),
    deleteMedication: build.mutation<void, string>({
      query: (id) => ({ url: `/medications/${id}/`, method: "DELETE" }),
      invalidatesTags: ["Medications", "Doses", "Timeline", "Dashboard"],
    }),
    medicationAction: build.mutation<Medication, { id: string; action: MedicationAction }>({
      query: ({ id, action }) => ({ url: `/medications/${id}/${action}/`, method: "POST" }),
      invalidatesTags: ["Medications", "Doses", "Dashboard"],
    }),
    logDose: build.mutation<MedicationLog, { id: string } & Req<"LogDoseRequest">>({
      query: ({ id, ...body }) => ({ url: `/medications/${id}/log/`, method: "POST", body }),
      invalidatesTags: ["Doses", "Dashboard", { type: "Medications", id: "LOGS" }],
    }),
    medicationLogs: build.query<Paginated<MedicationLog>, { id: string; page?: number }>({
      query: ({ id, page = 1 }) => ({ url: `/medications/${id}/logs/`, params: { page } }),
      providesTags: [{ type: "Medications", id: "LOGS" }],
    }),
    adherence: build.query<Adherence, { id: string; days?: number }>({
      query: ({ id, days = 30 }) => ({ url: `/medications/${id}/adherence/`, params: { days } }),
      providesTags: ["Doses"],
    }),
    todayDoses: build.query<TodayDoses, ProfileArg & { date?: string }>({
      query: (params) => ({ url: "/medications/today/", params: cleanParams(params) }),
      providesTags: ["Doses"],
    }),
  }),
});

export const {
  useMedicationsQuery,
  useMedicationQuery,
  useCreateMedicationMutation,
  useUpdateMedicationMutation,
  useDeleteMedicationMutation,
  useMedicationActionMutation,
  useLogDoseMutation,
  useMedicationLogsQuery,
  useAdherenceQuery,
  useTodayDosesQuery,
} = medicationsApi;
