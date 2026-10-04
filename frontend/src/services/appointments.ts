import { api, cleanParams } from "@/lib/api/baseApi";
import type { Appointment, AppointmentNote, Paginated } from "@/types/api";

import type { ListArgs, ProfileArg, Req } from "./types";

export const appointmentsApi = api.injectEndpoints({
  endpoints: (build) => ({
    appointments: build.query<Paginated<Appointment>, ListArgs & { view?: "upcoming" | "past" }>({
      query: (params) => ({ url: "/appointments/", params: cleanParams(params) }),
      providesTags: ["Appointments"],
    }),
    appointment: build.query<Appointment, string>({
      query: (id) => `/appointments/${id}/`,
      providesTags: (_r, _e, id) => [{ type: "Appointments", id }],
    }),
    createAppointment: build.mutation<Appointment, Req<"AppointmentRequest"> & ProfileArg>({
      query: (body) => ({ url: "/appointments/", method: "POST", body }),
      invalidatesTags: ["Appointments", "Timeline", "Dashboard"],
    }),
    updateAppointment: build.mutation<
      Appointment,
      { id: string } & Req<"PatchedAppointmentRequest">
    >({
      query: ({ id, ...body }) => ({ url: `/appointments/${id}/`, method: "PATCH", body }),
      invalidatesTags: ["Appointments", "Timeline", "Dashboard"],
    }),
    deleteAppointment: build.mutation<void, string>({
      query: (id) => ({ url: `/appointments/${id}/`, method: "DELETE" }),
      invalidatesTags: ["Appointments", "Timeline", "Dashboard"],
    }),
    changeAppointmentStatus: build.mutation<
      Appointment,
      { id: string } & Req<"StatusChangeRequest">
    >({
      query: ({ id, ...body }) => ({ url: `/appointments/${id}/status/`, method: "POST", body }),
      invalidatesTags: ["Appointments", "Timeline", "Dashboard"],
    }),
    addAppointmentNote: build.mutation<AppointmentNote, { id: string; body: string }>({
      query: ({ id, body }) => ({
        url: `/appointments/${id}/notes/`,
        method: "POST",
        body: { body },
      }),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Appointments", id }],
    }),
    deleteAppointmentNote: build.mutation<void, { id: string; noteId: string }>({
      query: ({ id, noteId }) => ({
        url: `/appointments/${id}/notes/${noteId}/`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Appointments", id }],
    }),
  }),
});

export const {
  useAppointmentsQuery,
  useAppointmentQuery,
  useCreateAppointmentMutation,
  useUpdateAppointmentMutation,
  useDeleteAppointmentMutation,
  useChangeAppointmentStatusMutation,
  useAddAppointmentNoteMutation,
  useDeleteAppointmentNoteMutation,
} = appointmentsApi;
