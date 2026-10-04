import { api, cleanParams } from "@/lib/api/baseApi";
import type { Dashboard, TimelinePage } from "@/types/api";

import type { ProfileArg } from "./types";

export type TimelineArgs = ProfileArg & {
  types?: string;
  from?: string;
  to?: string;
  q?: string;
  cursor?: string;
  limit?: number;
};

export const timelineApi = api.injectEndpoints({
  endpoints: (build) => ({
    timeline: build.query<TimelinePage, TimelineArgs>({
      query: (params) => ({ url: "/timeline/", params: cleanParams(params) }),
      providesTags: ["Timeline"],
    }),
    dashboard: build.query<Dashboard, ProfileArg>({
      query: (params) => ({ url: "/dashboard/", params: cleanParams(params) }),
      providesTags: ["Dashboard", "Doses", "Appointments", "Treatments", "Labs", "Notifications"],
    }),
  }),
});

export const { useTimelineQuery, useLazyTimelineQuery, useDashboardQuery } = timelineApi;
