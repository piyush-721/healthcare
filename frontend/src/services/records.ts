import { api, cleanParams } from "@/lib/api/baseApi";
import type { MedicalDocument, MedicalRecord, Paginated } from "@/types/api";

import type { ListArgs, ProfileArg, Req } from "./types";

export const recordsApi = api.injectEndpoints({
  endpoints: (build) => ({
    records: build.query<Paginated<MedicalRecord>, ListArgs>({
      query: (params) => ({ url: "/records/", params: cleanParams(params) }),
      providesTags: ["Records"],
    }),
    record: build.query<MedicalRecord, string>({
      query: (id) => `/records/${id}/`,
      providesTags: (_r, _e, id) => [{ type: "Records", id }],
    }),
    createRecord: build.mutation<MedicalRecord, Req<"MedicalRecordRequest"> & ProfileArg>({
      query: (body) => ({ url: "/records/", method: "POST", body }),
      invalidatesTags: ["Records", "Timeline", "Dashboard"],
    }),
    updateRecord: build.mutation<
      MedicalRecord,
      { id: string } & Req<"PatchedMedicalRecordRequest">
    >({
      query: ({ id, ...body }) => ({ url: `/records/${id}/`, method: "PATCH", body }),
      invalidatesTags: ["Records", "Timeline"],
    }),
    deleteRecord: build.mutation<void, string>({
      query: (id) => ({ url: `/records/${id}/`, method: "DELETE" }),
      invalidatesTags: ["Records", "Documents", "Timeline", "Dashboard"],
    }),

    documents: build.query<Paginated<MedicalDocument>, ListArgs & { archived?: boolean }>({
      query: (params) => ({ url: "/documents/", params: cleanParams(params) }),
      providesTags: ["Documents"],
    }),
    document: build.query<MedicalDocument, string>({
      query: (id) => `/documents/${id}/`,
      providesTags: (_r, _e, id) => [{ type: "Documents", id }],
    }),
    uploadDocument: build.mutation<MedicalDocument, FormData>({
      query: (body) => ({ url: "/documents/", method: "POST", body }),
      invalidatesTags: ["Documents", "Records", "Timeline", "Dashboard"],
    }),
    updateDocument: build.mutation<
      MedicalDocument,
      { id: string } & Req<"PatchedMedicalDocumentRequest">
    >({
      query: ({ id, ...body }) => ({ url: `/documents/${id}/`, method: "PATCH", body }),
      invalidatesTags: ["Documents", "Records"],
    }),
    archiveDocument: build.mutation<MedicalDocument, { id: string; restore?: boolean }>({
      query: ({ id, restore }) => ({
        url: `/documents/${id}/${restore ? "restore" : "archive"}/`,
        method: "POST",
      }),
      invalidatesTags: ["Documents", "Records", "Timeline"],
    }),
    deleteDocument: build.mutation<void, string>({
      query: (id) => ({ url: `/documents/${id}/`, method: "DELETE" }),
      invalidatesTags: ["Documents", "Records", "Timeline", "Dashboard"],
    }),
  }),
});

export const documentDownloadUrl = (id: string) => `/api/v1/documents/${id}/download/`;

export const {
  useRecordsQuery,
  useRecordQuery,
  useCreateRecordMutation,
  useUpdateRecordMutation,
  useDeleteRecordMutation,
  useDocumentsQuery,
  useDocumentQuery,
  useUploadDocumentMutation,
  useUpdateDocumentMutation,
  useArchiveDocumentMutation,
  useDeleteDocumentMutation,
} = recordsApi;
