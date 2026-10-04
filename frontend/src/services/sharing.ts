import { api, cleanParams } from "@/lib/api/baseApi";
import type {
  CreatedShare,
  DataShare,
  Paginated,
  SharedSection,
  ShareAccessLog,
  ShareSummary,
} from "@/types/api";

import type { Req } from "./types";

export const SHARE_TOKEN_HEADER = "X-Share-Token";

export const sharingApi = api.injectEndpoints({
  endpoints: (build) => ({
    shares: build.query<Paginated<DataShare>, { profile?: string; page?: number }>({
      query: (params) => ({ url: "/shares/", params: cleanParams(params) }),
      providesTags: ["Shares"],
    }),
    share: build.query<DataShare, string>({
      query: (id) => `/shares/${id}/`,
      providesTags: (_r, _e, id) => [{ type: "Shares", id }],
    }),
    createShare: build.mutation<CreatedShare, Req<"CreateShareRequest">>({
      query: (body) => ({ url: "/shares/", method: "POST", body }),
      invalidatesTags: ["Shares"],
    }),
    revokeShare: build.mutation<DataShare, string>({
      query: (id) => ({ url: `/shares/${id}/revoke/`, method: "POST" }),
      invalidatesTags: ["Shares"],
    }),
    shareAccessLogs: build.query<Paginated<ShareAccessLog>, { id: string; page?: number }>({
      query: ({ id, page = 1 }) => ({ url: `/shares/${id}/access-logs/`, params: { page } }),
      providesTags: ["Shares"],
    }),

    // Recipient (provider) side — authorized only by the share token header.
    sharedSummary: build.query<ShareSummary, string>({
      query: (token) => ({ url: "/shared/", headers: { [SHARE_TOKEN_HEADER]: token } }),
      keepUnusedDataFor: 0,
    }),
    sharedSection: build.query<Record<string, unknown>, { token: string; section: SharedSection }>({
      query: ({ token, section }) => ({
        url: `/shared/${section}/`,
        headers: { [SHARE_TOKEN_HEADER]: token },
      }),
      keepUnusedDataFor: 0,
    }),
  }),
});

export const sharedDocumentDownloadUrl = (id: string) => `/api/v1/shared/documents/${id}/download/`;

export const {
  useSharesQuery,
  useShareQuery,
  useCreateShareMutation,
  useRevokeShareMutation,
  useShareAccessLogsQuery,
  useSharedSummaryQuery,
  useSharedSectionQuery,
} = sharingApi;
