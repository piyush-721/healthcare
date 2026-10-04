import { api, cleanParams } from "@/lib/api/baseApi";
import type { LabReport, LabTestSummary, Paginated, TrendPoint } from "@/types/api";

import type { ListArgs, ProfileArg, Req } from "./types";

export const labsApi = api.injectEndpoints({
  endpoints: (build) => ({
    labReports: build.query<Paginated<LabReport>, ListArgs>({
      query: (params) => ({ url: "/lab-reports/", params: cleanParams(params) }),
      providesTags: ["Labs"],
    }),
    labReport: build.query<LabReport, string>({
      query: (id) => `/lab-reports/${id}/`,
      providesTags: (_r, _e, id) => [{ type: "Labs", id }],
    }),
    createLabReport: build.mutation<LabReport, Req<"LabReportRequest"> & ProfileArg>({
      query: (body) => ({ url: "/lab-reports/", method: "POST", body }),
      invalidatesTags: ["Labs", "Timeline", "Dashboard"],
    }),
    updateLabReport: build.mutation<LabReport, { id: string } & Req<"PatchedLabReportRequest">>({
      query: ({ id, ...body }) => ({ url: `/lab-reports/${id}/`, method: "PATCH", body }),
      invalidatesTags: ["Labs", "Timeline", "Dashboard"],
    }),
    deleteLabReport: build.mutation<void, string>({
      query: (id) => ({ url: `/lab-reports/${id}/`, method: "DELETE" }),
      invalidatesTags: ["Labs", "Timeline", "Dashboard"],
    }),
    labTests: build.query<LabTestSummary[], ProfileArg>({
      query: (params) => ({ url: "/lab-reports/tests/", params: cleanParams(params) }),
      providesTags: ["Labs"],
    }),
    labTrend: build.query<
      { test_key: string; points: TrendPoint[] },
      ProfileArg & { test: string }
    >({
      query: (params) => ({ url: "/lab-reports/trends/", params: cleanParams(params) }),
      providesTags: ["Labs"],
    }),
  }),
});

export const {
  useLabReportsQuery,
  useLabReportQuery,
  useCreateLabReportMutation,
  useUpdateLabReportMutation,
  useDeleteLabReportMutation,
  useLabTestsQuery,
  useLabTrendQuery,
} = labsApi;
