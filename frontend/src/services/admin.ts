import { api, cleanParams } from "@/lib/api/baseApi";
import type {
  AdminAuditEntry,
  AdminStats,
  AdminUser,
  AdminUserDetail,
  Paginated,
} from "@/types/api";

export type AdminUserFilters = { page?: number; search?: string; status?: string; role?: string };
export type AuditFilters = {
  page?: number;
  event_type?: string;
  search?: string;
  created_at__gte?: string;
  created_at__lte?: string;
  subject_user?: string;
};

export const adminApi = api.injectEndpoints({
  endpoints: (build) => ({
    adminStats: build.query<AdminStats, void>({
      query: () => "/admin/stats/",
      providesTags: ["AdminUsers"],
    }),
    adminConfig: build.query<Record<string, unknown>, void>({ query: () => "/admin/config/" }),
    adminUsers: build.query<Paginated<AdminUser>, AdminUserFilters>({
      query: (params) => ({ url: "/admin/users/", params: cleanParams(params) }),
      providesTags: ["AdminUsers"],
    }),
    adminUser: build.query<AdminUserDetail, string>({
      query: (id) => `/admin/users/${id}/`,
      providesTags: (_r, _e, id) => [{ type: "AdminUsers", id }],
    }),
    adminUserSecurityEvents: build.query<Paginated<AdminAuditEntry>, { id: string; page?: number }>(
      {
        query: ({ id, page = 1 }) => ({
          url: `/admin/users/${id}/security-events/`,
          params: { page },
        }),
        providesTags: ["AdminAudit"],
      },
    ),
    suspendUser: build.mutation<AdminUserDetail, { id: string; reason: string }>({
      query: ({ id, reason }) => ({
        url: `/admin/users/${id}/suspend/`,
        method: "POST",
        body: { reason },
      }),
      invalidatesTags: ["AdminUsers", "AdminAudit"],
    }),
    reactivateUser: build.mutation<AdminUserDetail, string>({
      query: (id) => ({ url: `/admin/users/${id}/reactivate/`, method: "POST" }),
      invalidatesTags: ["AdminUsers", "AdminAudit"],
    }),
    changeUserRole: build.mutation<AdminUserDetail, { id: string; role: "USER" | "ADMIN" }>({
      query: ({ id, role }) => ({
        url: `/admin/users/${id}/role/`,
        method: "POST",
        body: { role },
      }),
      invalidatesTags: ["AdminUsers", "AdminAudit"],
    }),
    auditLogs: build.query<Paginated<AdminAuditEntry>, AuditFilters>({
      query: (params) => ({ url: "/admin/audit-logs/", params: cleanParams(params) }),
      providesTags: ["AdminAudit"],
    }),
    auditEventTypes: build.query<{ value: string; label: string }[], void>({
      query: () => "/admin/audit-logs/event-types/",
    }),
  }),
});

export const {
  useAdminStatsQuery,
  useAdminConfigQuery,
  useAdminUsersQuery,
  useAdminUserQuery,
  useAdminUserSecurityEventsQuery,
  useSuspendUserMutation,
  useReactivateUserMutation,
  useChangeUserRoleMutation,
  useAuditLogsQuery,
  useAuditEventTypesQuery,
} = adminApi;
