import { api, cleanParams } from "@/lib/api/baseApi";
import type { Notification, NotificationPreference, Paginated } from "@/types/api";

import type { Req } from "./types";

export const notificationsApi = api.injectEndpoints({
  endpoints: (build) => ({
    notifications: build.query<
      Paginated<Notification>,
      { page?: number; unread?: boolean; category?: string }
    >({
      query: (params) => ({ url: "/notifications/", params: cleanParams(params) }),
      providesTags: ["Notifications"],
    }),
    unreadCount: build.query<{ unread: number }, void>({
      query: () => "/notifications/unread-count/",
      providesTags: ["Notifications"],
    }),
    markRead: build.mutation<Notification, string>({
      query: (id) => ({ url: `/notifications/${id}/read/`, method: "POST" }),
      invalidatesTags: ["Notifications", "Dashboard"],
    }),
    markAllRead: build.mutation<{ updated: number }, void>({
      query: () => ({ url: "/notifications/read-all/", method: "POST" }),
      invalidatesTags: ["Notifications", "Dashboard"],
    }),
    notificationPreferences: build.query<NotificationPreference[], void>({
      query: () => "/notifications/preferences/",
      providesTags: [{ type: "Notifications", id: "PREFS" }],
    }),
    updateNotificationPreferences: build.mutation<
      NotificationPreference[],
      Req<"NotificationPreferenceRequest">[]
    >({
      query: (body) => ({ url: "/notifications/preferences/", method: "PUT", body }),
      invalidatesTags: [{ type: "Notifications", id: "PREFS" }],
    }),
  }),
});

export const {
  useNotificationsQuery,
  useUnreadCountQuery,
  useMarkReadMutation,
  useMarkAllReadMutation,
  useNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
} = notificationsApi;
