"use client";

import { CalendarDays, Clock, MapPin, Phone, Plus, Stethoscope, Video, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  Pagination,
  QueryState,
  Tabs,
} from "@/components/ui";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { formatTime } from "@/lib/format";
import { useAppointmentsQuery } from "@/services/appointments";
import type { Appointment } from "@/types/api";

import { AppointmentFormDialog } from "./AppointmentFormDialog";
import { AppointmentStatusBadge } from "./AppointmentStatusBadge";
import { formatDayHeading, KIND_LABELS, localDayKey, providerLabel } from "./constants";
import { MiniCalendar } from "./MiniCalendar";

type View = "upcoming" | "past";

export function AppointmentsPage() {
  const { profileId, can } = useActiveProfile();
  const canManage = can("MANAGE_APPOINTMENTS");
  const [view, setView] = useState<View>("upcoming");
  const [page, setPage] = useState(1);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const listQuery = useAppointmentsQuery({ profile: profileId, view, page });
  // Calendar data: the next 100 upcoming appointments.
  const calendarQuery = useAppointmentsQuery({
    profile: profileId,
    view: "upcoming",
    page_size: 100,
  });
  // Past appointments still marked as scheduled need the user to record what happened.
  const needsUpdateQuery = useAppointmentsQuery({
    profile: profileId,
    view: "past",
    status: "SCHEDULED",
    page_size: 1,
  });
  const needsUpdateCount = needsUpdateQuery.data?.count ?? 0;

  const dayCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of calendarQuery.data?.results ?? []) {
      const key = localDayKey(a.scheduled_at);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [calendarQuery.data]);

  const changeView = (next: string) => {
    setView(next === "past" ? "past" : "upcoming");
    setPage(1);
    setSelectedDay(null);
  };

  const selectDay = (day: string | null) => {
    setSelectedDay(day);
    if (day) {
      setView("upcoming");
      setPage(1);
      document
        .getElementById("appointment-list")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const addButton = canManage && (
    <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setCreateOpen(true)}>
      New appointment
    </Button>
  );

  const dayAppointments = selectedDay
    ? (calendarQuery.data?.results ?? []).filter((a) => localDayKey(a.scheduled_at) === selectedDay)
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointments"
        description="Upcoming visits, past appointments and notes from each one."
        actions={addButton}
      />

      {needsUpdateCount > 0 && (
        <Alert
          tone="warning"
          title={`${needsUpdateCount} past ${needsUpdateCount === 1 ? "appointment needs" : "appointments need"} an update`}
          action={
            view !== "past" && (
              <Button size="sm" variant="secondary" onClick={() => changeView("past")}>
                Review
              </Button>
            )
          }
        >
          Record whether {needsUpdateCount === 1 ? "it" : "they"} took place so your history stays
          accurate.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div id="appointment-list" className="min-w-0 scroll-mt-4">
          <Tabs
            label="Appointment views"
            value={view}
            onChange={changeView}
            items={[
              { id: "upcoming", label: "Upcoming" },
              { id: "past", label: "Past" },
            ]}
          >
            {selectedDay ? (
              <Card>
                <CardHeader
                  title={formatDayHeading(selectedDay)}
                  description={`${dayAppointments.length} ${dayAppointments.length === 1 ? "appointment" : "appointments"}`}
                  action={
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<X className="size-4" aria-hidden />}
                      onClick={() => setSelectedDay(null)}
                    >
                      Show all
                    </Button>
                  }
                />
                <AppointmentList appointments={dayAppointments} showHeadings={false} />
              </Card>
            ) : (
              <QueryState
                query={listQuery}
                isEmpty={(data) => data.results.length === 0}
                empty={
                  <Card>
                    {view === "upcoming" ? (
                      <EmptyState
                        icon={CalendarDays}
                        title="No upcoming appointments"
                        description="Add your next doctor visit to get a reminder and keep notes in one place."
                        action={addButton}
                      />
                    ) : (
                      <EmptyState
                        icon={CalendarDays}
                        title="No past appointments"
                        description="Appointments move here once their time has passed."
                      />
                    )}
                  </Card>
                }
              >
                {(data) => (
                  <Card>
                    <AppointmentList appointments={data.results} showHeadings />
                    <Pagination page={page} count={data.count} onChange={setPage} />
                  </Card>
                )}
              </QueryState>
            )}
          </Tabs>
        </div>
        <aside aria-label="Calendar" className="max-lg:hidden">
          <Card>
            <CardBody>
              <MiniCalendar counts={dayCounts} selected={selectedDay} onSelect={selectDay} />
              <p className="mt-3 text-xs text-slate-500">
                Highlighted days have upcoming appointments.
              </p>
            </CardBody>
          </Card>
        </aside>
      </div>
      <AppointmentFormDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function groupByDay(appointments: Appointment[]): [string, Appointment[]][] {
  const groups = new Map<string, Appointment[]>();
  for (const a of appointments) {
    const key = localDayKey(a.scheduled_at);
    const list = groups.get(key) ?? [];
    list.push(a);
    groups.set(key, list);
  }
  return [...groups.entries()];
}

export function AppointmentList({
  appointments,
  showHeadings,
}: {
  appointments: Appointment[];
  showHeadings: boolean;
}) {
  if (!showHeadings) {
    return (
      <ul className="divide-y divide-slate-100">
        {appointments.map((a) => (
          <AppointmentRow key={a.id} appointment={a} />
        ))}
      </ul>
    );
  }
  return (
    <div className="divide-y divide-slate-200">
      {groupByDay(appointments).map(([day, items]) => (
        <section key={day} aria-labelledby={`day-${day}`}>
          <h3
            id={`day-${day}`}
            className="bg-slate-50 px-4 py-2 text-xs font-semibold tracking-wide text-slate-600 uppercase sm:px-5"
          >
            {formatDayHeading(day)}
          </h3>
          <ul className="divide-y divide-slate-100">
            {items.map((a) => (
              <AppointmentRow key={a.id} appointment={a} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

const KIND_ICONS = { IN_PERSON: MapPin, VIDEO: Video, PHONE: Phone } as const;

function AppointmentRow({ appointment }: { appointment: Appointment }) {
  const kind = appointment.kind ?? "IN_PERSON";
  const KindIcon = KIND_ICONS[kind];
  const provider = providerLabel(appointment);
  return (
    <li className="relative flex gap-3 px-4 py-3 hover:bg-slate-50/60 sm:gap-4 sm:px-5">
      <div className="w-16 shrink-0 pt-0.5 text-sm font-semibold text-slate-900 tabular-nums sm:w-20">
        {formatTime(appointment.scheduled_at)}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/appointments/${appointment.id}`}
            className="hover:text-brand-800 font-medium text-slate-900 after:absolute after:inset-0"
          >
            {appointment.title}
          </Link>
          <AppointmentStatusBadge appointment={appointment} />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
          {provider && (
            <span className="inline-flex items-center gap-1">
              <Stethoscope className="size-3.5" aria-hidden />
              {provider}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <KindIcon className="size-3.5" aria-hidden />
            {KIND_LABELS[kind]}
          </span>
          {appointment.location && <span className="min-w-0 truncate">{appointment.location}</span>}
          {appointment.duration_minutes ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden />
              {appointment.duration_minutes} min
            </span>
          ) : null}
        </div>
      </div>
    </li>
  );
}
