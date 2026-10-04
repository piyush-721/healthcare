"use client";

import {
  AlertCircle,
  Bell,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  FileUp,
  FlaskConical,
  History,
  Pill,
  Share2,
  Users,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { MedicalDisclaimer } from "@/components/domain/MedicalDisclaimer";
import {
  Alert,
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  LinkButton,
  Skeleton,
} from "@/components/ui";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime } from "@/lib/format";
import { resourceHref } from "@/lib/routes";
import { TodayDoses } from "@/features/medications/TodayDoses";
import { useDashboardQuery } from "@/services/timeline";
import { useAppSelector } from "@/store/hooks";
import type { Dashboard as DashboardData } from "@/types/api";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function Section({
  title,
  icon,
  href,
  linkLabel,
  children,
}: {
  title: string;
  icon: ReactNode;
  href?: string;
  linkLabel?: string;
  children: ReactNode;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            {icon}
            {title}
          </span>
        }
        action={
          href ? (
            <Link href={href} className="text-brand-700 text-sm font-medium hover:underline">
              {linkLabel ?? "View all"}
            </Link>
          ) : undefined
        }
      />
      <CardBody className="flex-1">{children}</CardBody>
    </Card>
  );
}

function QuickActions({ data }: { data: DashboardData }) {
  const { can, isOwner } = useActiveProfile();
  const actions = [
    { href: "/medications", label: "Add medication", icon: Pill, show: can("MANAGE_MEDICATIONS") },
    {
      href: "/appointments",
      label: "New appointment",
      icon: CalendarPlus,
      show: can("MANAGE_APPOINTMENTS"),
    },
    { href: "/records", label: "Upload document", icon: FileUp, show: can("UPLOAD_DOCUMENTS") },
    {
      href: "/sharing",
      label: "Share with a doctor",
      icon: Share2,
      show: isOwner && data.profile.access_role === "OWNER",
    },
  ].filter((a) => a.show);
  if (!actions.length) return null;
  return (
    <nav aria-label="Quick actions" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {actions.map((action) => (
        <Link
          key={action.label}
          href={action.href}
          className="hover:border-brand-300 hover:bg-brand-50/40 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-800 shadow-[var(--shadow-card)]"
        >
          <span className="bg-brand-50 text-brand-700 grid size-9 shrink-0 place-items-center rounded-lg">
            <action.icon className="size-[18px]" aria-hidden />
          </span>
          {action.label}
        </Link>
      ))}
    </nav>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    </div>
  );
}

export function Dashboard() {
  const { profileId } = useActiveProfile();
  const user = useAppSelector((state) => state.auth.user);
  const query = useDashboardQuery({ profile: profileId });

  if (query.isLoading) return <DashboardSkeleton />;
  if (query.error || !query.data) return <ErrorState error={query.error} onRetry={query.refetch} />;
  const data = query.data;
  const firstName = user?.full_name.split(" ")[0] ?? "";

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-slate-500">{formatDate(data.date)}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {data.profile.is_self
            ? `${greeting()}, ${firstName}`
            : `${data.profile.full_name}'s health today`}
        </h1>
      </header>

      <QuickActions data={data} />

      {!!data.appointments_needing_update && (
        <Alert
          tone="warning"
          title="Appointments need an update"
          action={
            <LinkButton href="/appointments" variant="secondary" size="sm">
              Review
            </LinkButton>
          }
        >
          {data.appointments_needing_update} past appointment
          {data.appointments_needing_update > 1 ? "s are" : " is"} still marked as upcoming. Record
          whether they were completed or missed.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {data.todays_doses !== null && <TodayDoses />}

        {data.upcoming_appointments !== null && (
          <Section
            title="Upcoming appointments"
            icon={<CalendarDays className="text-brand-700 size-4" aria-hidden />}
            href="/appointments"
          >
            {data.upcoming_appointments.length ? (
              <ul className="space-y-3">
                {data.upcoming_appointments.map((appt) => (
                  <li key={appt.id}>
                    <Link
                      href={`/appointments/${appt.id}`}
                      className="-m-2 flex items-start gap-3 rounded-lg p-2 hover:bg-slate-50"
                    >
                      <div className="bg-brand-50 text-brand-800 w-14 shrink-0 rounded-lg py-1 text-center">
                        <p className="text-[11px] font-medium uppercase">
                          {new Date(appt.scheduled_at).toLocaleDateString(undefined, {
                            month: "short",
                          })}
                        </p>
                        <p className="text-lg leading-tight font-semibold">
                          {new Date(appt.scheduled_at).getDate()}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">{appt.title}</p>
                        <p className="truncate text-xs text-slate-500">
                          {formatDateTime(appt.scheduled_at)}
                          {appt.provider ? ` · ${appt.provider}` : ""}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={CalendarDays} title="No upcoming appointments" className="py-4" />
            )}
          </Section>
        )}

        {data.pending_tasks !== null && (
          <Section
            title="Treatment tasks"
            icon={<ClipboardList className="text-brand-700 size-4" aria-hidden />}
            href="/treatments"
          >
            {data.pending_tasks.length ? (
              <ul className="divide-y divide-slate-100">
                {data.pending_tasks.map((task) => (
                  <li key={task.id} className="flex items-center gap-3 py-2.5">
                    <AlertCircle
                      className={cn(
                        "size-4 shrink-0",
                        task.overdue ? "text-amber-600" : "text-slate-300",
                      )}
                      aria-hidden
                    />
                    <Link href={`/treatments/${task.plan_id}`} className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900 hover:underline">
                        {task.title}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {task.plan_title}
                      </span>
                    </Link>
                    {task.due_date && (
                      <Badge tone={task.overdue ? "warning" : "neutral"}>
                        {task.overdue ? "Overdue · " : "Due "}
                        {formatDate(task.due_date)}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <CheckCircle2 className="size-4 text-emerald-600" aria-hidden /> No pending tasks.
              </p>
            )}
          </Section>
        )}

        {data.recent_lab_reports !== null && (
          <Section
            title="Recent lab reports"
            icon={<FlaskConical className="text-brand-700 size-4" aria-hidden />}
            href="/labs"
          >
            {data.recent_lab_reports.length ? (
              <ul className="divide-y divide-slate-100">
                {data.recent_lab_reports.map((report) => (
                  <li key={report.id} className="py-2.5">
                    <Link
                      href={`/labs/${report.id}`}
                      className="text-sm font-medium text-slate-900 hover:underline"
                    >
                      {report.title}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {formatDate(report.report_date)}
                      {report.lab_name ? ` · ${report.lab_name}` : ""} · {report.result_count}{" "}
                      results
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No lab reports in the last 6 months.</p>
            )}
          </Section>
        )}

        <Section
          title="Recent activity"
          icon={<History className="text-brand-700 size-4" aria-hidden />}
          href="/timeline"
          linkLabel="Open timeline"
        >
          {data.recent_events.length ? (
            <ol className="relative space-y-4 border-l border-slate-200 pl-5">
              {data.recent_events.map((event) => (
                <li key={event.id} className="relative">
                  <span
                    className="bg-brand-500 absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-white"
                    aria-hidden
                  />
                  <Link
                    href={resourceHref(event.resource, event.resource_id)}
                    className="text-sm font-medium text-slate-900 hover:underline"
                  >
                    {event.title}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {event.all_day
                      ? formatDate(event.occurred_at.slice(0, 10))
                      : formatDateTime(event.occurred_at)}
                    {event.subtitle ? ` · ${event.subtitle}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState
              icon={History}
              title="Nothing here yet"
              description="Add a medication, appointment or record to start your timeline."
              className="py-4"
            />
          )}
        </Section>

        <Section
          title="Family & notifications"
          icon={<Users className="text-brand-700 size-4" aria-hidden />}
          href="/family"
          linkLabel="Manage family"
        >
          <dl className="grid grid-cols-2 gap-3">
            {[
              { label: "Family members you manage", value: data.family.dependents },
              { label: "Caregivers helping you", value: data.family.caregivers },
              { label: "People you care for", value: data.family.caring_for },
              {
                label: "Unread notifications",
                value: data.unread_notifications,
                href: "/notifications",
                icon: true,
              },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg bg-slate-50 p-3">
                <dt className="text-xs text-slate-500">{stat.label}</dt>
                <dd className="mt-1 flex items-center gap-1.5 text-xl font-semibold text-slate-900">
                  {stat.icon && <Bell className="size-4 text-slate-400" aria-hidden />}
                  {stat.href ? (
                    <Link href={stat.href} className="hover:underline">
                      {stat.value}
                    </Link>
                  ) : (
                    stat.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </Section>
      </div>

      <MedicalDisclaimer />
    </div>
  );
}
