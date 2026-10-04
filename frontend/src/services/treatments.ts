import { api, cleanParams } from "@/lib/api/baseApi";
import type { Paginated, TreatmentPlan, TreatmentTask } from "@/types/api";

import type { ListArgs, ProfileArg, Req } from "./types";

export const treatmentsApi = api.injectEndpoints({
  endpoints: (build) => ({
    treatmentPlans: build.query<Paginated<TreatmentPlan>, ListArgs>({
      query: (params) => ({ url: "/treatment-plans/", params: cleanParams(params) }),
      providesTags: ["Treatments"],
    }),
    treatmentPlan: build.query<TreatmentPlan, string>({
      query: (id) => `/treatment-plans/${id}/`,
      providesTags: (_r, _e, id) => [{ type: "Treatments", id }],
    }),
    createTreatmentPlan: build.mutation<TreatmentPlan, Req<"TreatmentPlanRequest"> & ProfileArg>({
      query: (body) => ({ url: "/treatment-plans/", method: "POST", body }),
      invalidatesTags: ["Treatments", "Timeline", "Dashboard"],
    }),
    updateTreatmentPlan: build.mutation<
      TreatmentPlan,
      { id: string } & Req<"PatchedTreatmentPlanRequest">
    >({
      query: ({ id, ...body }) => ({ url: `/treatment-plans/${id}/`, method: "PATCH", body }),
      invalidatesTags: ["Treatments", "Timeline", "Dashboard"],
    }),
    deleteTreatmentPlan: build.mutation<void, string>({
      query: (id) => ({ url: `/treatment-plans/${id}/`, method: "DELETE" }),
      invalidatesTags: ["Treatments", "Timeline", "Dashboard"],
    }),
    addTreatmentTask: build.mutation<
      TreatmentTask,
      { planId: string } & Req<"TreatmentTaskRequest">
    >({
      query: ({ planId, ...body }) => ({
        url: `/treatment-plans/${planId}/tasks/`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Treatments", "Dashboard"],
    }),
    updateTreatmentTask: build.mutation<
      TreatmentTask,
      { planId: string; taskId: string } & Req<"PatchedTreatmentTaskRequest">
    >({
      query: ({ planId, taskId, ...body }) => ({
        url: `/treatment-plans/${planId}/tasks/${taskId}/`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Treatments", "Timeline", "Dashboard"],
    }),
    deleteTreatmentTask: build.mutation<void, { planId: string; taskId: string }>({
      query: ({ planId, taskId }) => ({
        url: `/treatment-plans/${planId}/tasks/${taskId}/`,
        method: "DELETE",
      }),
      invalidatesTags: ["Treatments", "Dashboard"],
    }),
  }),
});

export const {
  useTreatmentPlansQuery,
  useTreatmentPlanQuery,
  useCreateTreatmentPlanMutation,
  useUpdateTreatmentPlanMutation,
  useDeleteTreatmentPlanMutation,
  useAddTreatmentTaskMutation,
  useUpdateTreatmentTaskMutation,
  useDeleteTreatmentTaskMutation,
} = treatmentsApi;
