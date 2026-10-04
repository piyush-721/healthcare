"use client";

import { ChevronRight, Users } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import {
  Card,
  EmptyState,
  Field,
  Input,
  LoadingState,
  PageHeader,
  Pagination,
  QueryState,
  Select,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/format";
import { useAdminUsersQuery } from "@/services/admin";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";

import { RoleBadge, UserStatusBadge, VerifiedBadge } from "./badges";

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "DEACTIVATED", label: "Deactivated" },
];
const ROLE_OPTIONS = [
  { value: "USER", label: "User" },
  { value: "ADMIN", label: "Admin" },
];
const pick = (value: string | null, options: { value: string }[]) =>
  options.some((o) => o.value === value) ? (value ?? "") : "";

function UsersContent() {
  const params = useSearchParams();
  const [search, setSearch] = useState(() => params.get("search") ?? "");
  const [status, setStatus] = useState(() => pick(params.get("status"), STATUS_OPTIONS));
  const [role, setRole] = useState(() => pick(params.get("role"), ROLE_OPTIONS));
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search.trim(), 300);
  const query = useAdminUsersQuery({
    search: debounced || undefined,
    status: status || undefined,
    role: role || undefined,
    page,
  });

  return (
    <>
      <PageHeader
        title="Users"
        description="Accounts on the platform. Health information is never shown here."
      />
      <Card>
        <div className="grid gap-3 border-b border-slate-100 px-4 py-4 sm:grid-cols-4 sm:px-5">
          <Field label="Search" className="sm:col-span-2">
            <Input
              type="search"
              value={search}
              placeholder="Email or name…"
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </Field>
          <Field label="Status">
            <Select
              value={status}
              options={STATUS_OPTIONS}
              placeholder="All statuses"
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            />
          </Field>
          <Field label="Role">
            <Select
              value={role}
              options={ROLE_OPTIONS}
              placeholder="All roles"
              onChange={(e) => {
                setRole(e.target.value);
                setPage(1);
              }}
            />
          </Field>
        </div>
        <QueryState
          query={query}
          isEmpty={(d) => d.results.length === 0}
          empty={
            <EmptyState
              icon={Users}
              title="No users found"
              description="Try a different search or clear the filters."
            />
          }
        >
          {(data) => (
            <>
              <ul className="divide-y divide-slate-100 md:hidden">
                {data.results.map((user) => (
                  <li key={user.id}>
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="truncate font-medium text-slate-900">{user.email}</p>
                        <p className="truncate text-sm text-slate-600">{user.full_name || "—"}</p>
                        <div className="flex flex-wrap gap-1.5">
                          <UserStatusBadge status={user.status} />
                          <RoleBadge role={user.role} />
                          <VerifiedBadge verified={user.email_verified} />
                        </div>
                        <p className="text-xs text-slate-500">
                          Joined {formatDate(user.date_joined)} · Last login{" "}
                          {user.last_login ? formatDateTime(user.last_login) : "never"}
                        </p>
                      </div>
                      <ChevronRight className="size-4 text-slate-400" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="hidden md:block">
                <Table caption="Users">
                  <THead>
                    <tr>
                      <Th>Email</Th>
                      <Th>Name</Th>
                      <Th>Role</Th>
                      <Th>Status</Th>
                      <Th>Email verified</Th>
                      <Th>Joined</Th>
                      <Th>Last login</Th>
                    </tr>
                  </THead>
                  <TBody>
                    {data.results.map((user) => (
                      <Tr key={user.id}>
                        <Td>
                          <Link
                            href={`/admin/users/${user.id}`}
                            className="text-brand-700 font-medium hover:underline"
                          >
                            {user.email}
                          </Link>
                        </Td>
                        <Td>{user.full_name || "—"}</Td>
                        <Td>
                          <RoleBadge role={user.role} />
                        </Td>
                        <Td>
                          <UserStatusBadge status={user.status} />
                        </Td>
                        <Td>{user.email_verified ? "Yes" : "No"}</Td>
                        <Td className="whitespace-nowrap">{formatDate(user.date_joined)}</Td>
                        <Td className="whitespace-nowrap">
                          {user.last_login ? formatDateTime(user.last_login) : "Never"}
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              </div>
              <Pagination page={page} count={data.count} onChange={setPage} />
            </>
          )}
        </QueryState>
      </Card>
    </>
  );
}

export function AdminUsersPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <UsersContent />
    </Suspense>
  );
}
