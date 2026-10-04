"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Card, CardBody, CardHeader, PageHeader, QueryState, Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { humanize } from "@/lib/format";
import { useAdminConfigQuery, useAdminStatsQuery } from "@/services/admin";
import type { AdminStats } from "@/types/api";

function StatTile({
  label,
  value,
  href,
  hint,
}: {
  label: string;
  value: number;
  href?: string;
  hint?: string;
}) {
  const body = (
    <>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">
        {value.toLocaleString()}
      </p>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </>
  );
  const cls = "block rounded-lg border border-slate-200 bg-white px-4 py-3";
  return (
    <li>
      {href ? (
        <Link href={href} className={cn(cls, "hover:border-brand-200 hover:bg-brand-50/30 h-full")}>
          {body}
        </Link>
      ) : (
        <div className={cn(cls, "h-full")}>{body}</div>
      )}
    </li>
  );
}

function StatGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</ul>
    </section>
  );
}

function Stats({ stats }: { stats: AdminStats }) {
  const u = stats.users;
  const a = stats.audit_last_24h;
  return (
    <div className="space-y-6">
      <StatGroup title="Accounts">
        <StatTile label="Total users" value={u.total} href="/admin/users" />
        <StatTile label="Active" value={u.active} href="/admin/users?status=ACTIVE" />
        <StatTile label="Suspended" value={u.suspended} href="/admin/users?status=SUSPENDED" />
        <StatTile
          label="Deactivated"
          value={u.deactivated}
          href="/admin/users?status=DEACTIVATED"
        />
        <StatTile label="Unverified email" value={u.unverified} />
        <StatTile label="Admins" value={u.admins} href="/admin/users?role=ADMIN" />
        <StatTile label="New (7 days)" value={u.new_7d} />
        <StatTile label="New (30 days)" value={u.new_30d} />
      </StatGroup>
      <StatGroup title="Security · last 24 hours">
        <StatTile label="Active sessions" value={stats.active_sessions} hint="Right now" />
        <StatTile label="Audit events" value={a.total} href="/admin/audit-logs" />
        <StatTile
          label="Failed logins"
          value={a.failed_logins}
          href="/admin/audit-logs?event_type=LOGIN_FAILED"
        />
        <StatTile
          label="Token reuse detected"
          value={a.token_reuse}
          href="/admin/audit-logs?event_type=REFRESH_TOKEN_REUSE"
        />
        <StatTile
          label="Share access denied"
          value={a.share_denials}
          href="/admin/audit-logs?event_type=SHARE_ACCESS_DENIED"
        />
      </StatGroup>
    </div>
  );
}

function ConfigValue({ value }: { value: unknown }): ReactNode {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return (
      <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[max-content_1fr]">
        {Object.entries(value).map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="font-mono text-xs text-slate-500">{k}</dt>
            <dd className="font-mono text-xs text-slate-800">
              <ConfigValue value={v} />
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  if (Array.isArray(value))
    return <span className="font-mono text-xs">{value.map(String).join(", ") || "—"}</span>;
  if (value === null || value === undefined || value === "") return "—";
  return <span className="font-mono text-sm">{String(value)}</span>;
}

export function AdminOverviewPage() {
  const stats = useAdminStatsQuery();
  const config = useAdminConfigQuery();
  return (
    <>
      <PageHeader title="Overview" description="Account and security metrics for the platform." />
      <div className="space-y-6">
        <QueryState
          query={stats}
          loading={
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-busy>
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          }
        >
          {(data) => <Stats stats={data} />}
        </QueryState>
        <Card>
          <CardHeader
            title="Platform configuration"
            description="Read-only, non-secret settings. Change them in the server environment."
          />
          <CardBody className="py-1">
            <QueryState
              query={config}
              isEmpty={(d) => Object.keys(d).length === 0}
              empty={<p className="py-4 text-sm text-slate-500">No configuration reported.</p>}
            >
              {(data) => (
                <dl className="divide-y divide-slate-100">
                  {Object.entries(data).map(([key, value]) => (
                    <div
                      key={key}
                      className="grid grid-cols-1 gap-1 py-2.5 sm:grid-cols-3 sm:gap-4"
                    >
                      <dt className="text-sm text-slate-500">{humanize(key)}</dt>
                      <dd className="text-sm text-slate-900 sm:col-span-2">
                        <ConfigValue value={value} />
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </QueryState>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
