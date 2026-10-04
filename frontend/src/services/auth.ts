import { api } from "@/lib/api/baseApi";
import { getCsrfToken } from "@/lib/api/csrf";
import type { AuditEntry, AuthResponse, Paginated, Session, User } from "@/types/api";

import type { Req } from "./types";

type Detail = { detail: string };

const withCsrf = async () => ({ "X-CSRFToken": await getCsrfToken() });

export const authApi = api.injectEndpoints({
  endpoints: (build) => ({
    register: build.mutation<Detail, Req<"RegisterRequest">>({
      query: (body) => ({ url: "/auth/register/", method: "POST", body }),
    }),
    verifyEmail: build.mutation<Detail, { token: string }>({
      query: (body) => ({ url: "/auth/verify-email/", method: "POST", body }),
    }),
    resendVerification: build.mutation<Detail, { email: string }>({
      query: (body) => ({ url: "/auth/verify-email/resend/", method: "POST", body }),
    }),
    login: build.mutation<AuthResponse, Req<"LoginRequest">>({
      queryFn: async (body, _api, _extra, baseQuery) => {
        const result = await baseQuery({
          url: "/auth/login/",
          method: "POST",
          body,
          headers: await withCsrf(),
        });
        return result.error ? { error: result.error } : { data: result.data as AuthResponse };
      },
    }),
    logout: build.mutation<void, void>({
      queryFn: async (_arg, _api, _extra, baseQuery) => {
        const result = await baseQuery({
          url: "/auth/logout/",
          method: "POST",
          headers: await withCsrf(),
        });
        return result.error ? { error: result.error } : { data: undefined };
      },
    }),
    logoutAll: build.mutation<void, void>({
      query: () => ({ url: "/auth/logout-all/", method: "POST" }),
    }),
    forgotPassword: build.mutation<Detail, { email: string }>({
      query: (body) => ({ url: "/auth/password/forgot/", method: "POST", body }),
    }),
    resetPassword: build.mutation<Detail, Req<"ResetPasswordRequest">>({
      query: (body) => ({ url: "/auth/password/reset/", method: "POST", body }),
    }),
    changePassword: build.mutation<Detail, Req<"ChangePasswordRequest">>({
      query: (body) => ({ url: "/auth/password/change/", method: "POST", body }),
      invalidatesTags: ["Sessions", "SecurityActivity"],
    }),
    deactivateAccount: build.mutation<void, { password: string }>({
      query: (body) => ({ url: "/auth/account/deactivate/", method: "POST", body }),
    }),
    requestReactivation: build.mutation<Detail, { email: string }>({
      query: (body) => ({ url: "/auth/account/reactivate/request/", method: "POST", body }),
    }),
    confirmReactivation: build.mutation<Detail, { token: string }>({
      query: (body) => ({ url: "/auth/account/reactivate/confirm/", method: "POST", body }),
    }),
    me: build.query<User, void>({ query: () => "/auth/me/", providesTags: ["Me"] }),
    updateMe: build.mutation<User, Req<"PatchedUserUpdateRequest">>({
      query: (body) => ({ url: "/auth/me/", method: "PATCH", body }),
      invalidatesTags: ["Me"],
    }),
    sessions: build.query<Session[], void>({
      query: () => "/auth/sessions/",
      providesTags: ["Sessions"],
    }),
    revokeSession: build.mutation<void, string>({
      query: (id) => ({ url: `/auth/sessions/${id}/`, method: "DELETE" }),
      invalidatesTags: ["Sessions", "SecurityActivity"],
    }),
    securityActivity: build.query<Paginated<AuditEntry>, { page?: number }>({
      query: ({ page = 1 }) => ({ url: "/auth/security-activity/", params: { page } }),
      providesTags: ["SecurityActivity"],
    }),
  }),
});

export const {
  useRegisterMutation,
  useVerifyEmailMutation,
  useResendVerificationMutation,
  useLoginMutation,
  useLogoutMutation,
  useLogoutAllMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useChangePasswordMutation,
  useDeactivateAccountMutation,
  useRequestReactivationMutation,
  useConfirmReactivationMutation,
  useMeQuery,
  useUpdateMeMutation,
  useSessionsQuery,
  useRevokeSessionMutation,
  useSecurityActivityQuery,
} = authApi;
