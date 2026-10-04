"use client";

import { LogOut, Monitor, ShieldAlert, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  FormActions,
  Input,
  PageHeader,
  Pagination,
  QueryState,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
  type BadgeTone,
} from "@/components/ui";
import { useToast } from "@/hooks/useToast";
import { getFieldErrors } from "@/lib/api/errors";
import { formatDateTime, formatRelative, humanize } from "@/lib/format";
import {
  useDeactivateAccountMutation,
  useLogoutAllMutation,
  useRevokeSessionMutation,
  useSecurityActivityQuery,
  useSessionsQuery,
} from "@/services/auth";
import { useAppDispatch } from "@/store/hooks";
import { signedOut } from "@/store/slices/authSlice";
import type { Session } from "@/types/api";

import { ChangePasswordForm } from "./ChangePasswordForm";

/** Rough, privacy-friendly device label from a user agent string. */
export function describeDevice(userAgent?: string): { label: string; mobile: boolean } {
  const ua = userAgent ?? "";
  if (!ua) return { label: "Unknown device", mobile: false };
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : /curl|python|okhttp/i.test(ua)
            ? "App"
            : "Browser";
  const os = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return { label: os ? `${browser} on ${os}` : browser, mobile: /Mobi|iPhone|Android/.test(ua) };
}

const EVENT_LABELS: Record<string, { label: string; tone?: BadgeTone }> = {
  SIGNUP: { label: "Account created" },
  LOGIN: { label: "Signed in" },
  LOGIN_FAILED: { label: "Failed sign-in attempt", tone: "warning" },
  LOGOUT: { label: "Signed out" },
  LOGOUT_ALL: { label: "Signed out of all devices" },
  SESSION_REVOKED: { label: "Session revoked" },
  REFRESH_TOKEN_REUSE: { label: "Suspicious session reuse blocked", tone: "danger" },
  EMAIL_VERIFIED: { label: "Email verified", tone: "success" },
  PASSWORD_CHANGED: { label: "Password changed", tone: "info" },
  PASSWORD_RESET_REQUESTED: { label: "Password reset requested", tone: "info" },
  PASSWORD_RESET: { label: "Password reset", tone: "info" },
  ACCOUNT_DEACTIVATED: { label: "Account deactivated", tone: "warning" },
  ACCOUNT_REACTIVATED: { label: "Account reactivated", tone: "success" },
  ACCOUNT_SUSPENDED: { label: "Account suspended", tone: "danger" },
  ROLE_CHANGED: { label: "Role changed", tone: "info" },
};

export function eventLabel(type: string): { label: string; tone: BadgeTone } {
  const meta = EVENT_LABELS[type];
  return { label: meta?.label ?? humanize(type), tone: meta?.tone ?? "neutral" };
}

function SessionsCard() {
  const query = useSessionsQuery();
  const [revokeSession, { isLoading: revoking }] = useRevokeSessionMutation();
  const [logoutAll, { isLoading: loggingOut }] = useLogoutAllMutation();
  const [target, setTarget] = useState<Session | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const toast = useToast();

  return (
    <Card>
      <CardHeader
        title="Active sessions"
        description="Devices currently signed in to your account."
        action={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setConfirmAll(true)}
            icon={<LogOut className="size-4" aria-hidden />}
          >
            <span className="max-sm:sr-only">Sign out of all devices</span>
          </Button>
        }
      />
      <QueryState
        query={query}
        isEmpty={(d) => d.length === 0}
        empty={<EmptyState icon={Monitor} title="No active sessions" />}
      >
        {(sessions) => (
          <ul className="divide-y divide-slate-100">
            {[...sessions]
              .sort((a, b) => Number(b.current) - Number(a.current))
              .map((s) => {
                const device = describeDevice(s.user_agent);
                const Icon = device.mobile ? Smartphone : Monitor;
                return (
                  <li
                    key={s.id}
                    className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <Icon className="mt-0.5 size-5 shrink-0 text-slate-400" aria-hidden />
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                          {device.label}
                          {s.current && <Badge tone="brand">This device</Badge>}
                        </p>
                        <p className="text-xs text-slate-500">
                          {[
                            s.ip_address,
                            `Signed in ${formatDateTime(s.created_at)}`,
                            s.last_used_at ? `Last active ${formatRelative(s.last_used_at)}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    </div>
                    {!s.current && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="self-start text-red-700 hover:bg-red-50 sm:self-auto"
                        onClick={() => setTarget(s)}
                        aria-label={`Sign out ${device.label}`}
                      >
                        Sign out
                      </Button>
                    )}
                  </li>
                );
              })}
          </ul>
        )}
      </QueryState>
      <ConfirmDialog
        open={target !== null}
        onClose={() => setTarget(null)}
        title="Sign out this device?"
        message={
          target
            ? `${describeDevice(target.user_agent).label}${target.ip_address ? ` (${target.ip_address})` : ""} will be signed out immediately.`
            : ""
        }
        confirmLabel="Sign out device"
        loading={revoking}
        onConfirm={async () => {
          if (!target) return;
          try {
            await revokeSession(target.id).unwrap();
            toast.success("Device signed out.");
            setTarget(null);
          } catch (err) {
            toast.error(err);
          }
        }}
      />
      <ConfirmDialog
        open={confirmAll}
        onClose={() => setConfirmAll(false)}
        title="Sign out of all devices?"
        message="Every device, including this one, will be signed out. You'll need to sign in again."
        confirmLabel="Sign out everywhere"
        loading={loggingOut}
        onConfirm={async () => {
          try {
            await logoutAll().unwrap();
          } catch {
            /* Even if the request fails, clear this device's session. */
          }
          dispatch(signedOut());
          router.replace("/login");
          toast.info("You've been signed out of all devices.");
        }}
      />
    </Card>
  );
}

function ActivityCard() {
  const [page, setPage] = useState(1);
  const query = useSecurityActivityQuery({ page });
  return (
    <Card>
      <CardHeader title="Security activity" description="Recent sign-ins and account changes." />
      <QueryState
        query={query}
        isEmpty={(d) => d.results.length === 0}
        empty={<EmptyState icon={ShieldAlert} title="No activity yet" />}
      >
        {(data) => (
          <>
            <div className="hidden sm:block">
              <Table caption="Security activity">
                <THead>
                  <tr>
                    <Th>Event</Th>
                    <Th>Device</Th>
                    <Th>IP address</Th>
                    <Th>When</Th>
                  </tr>
                </THead>
                <TBody>
                  {data.results.map((e) => {
                    const meta = eventLabel(e.event_type);
                    return (
                      <Tr key={e.id}>
                        <Td>
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                        </Td>
                        <Td>{describeDevice(e.user_agent).label}</Td>
                        <Td className="font-mono text-xs">{e.ip_address || "—"}</Td>
                        <Td>
                          <time dateTime={e.created_at} title={formatRelative(e.created_at)}>
                            {formatDateTime(e.created_at)}
                          </time>
                        </Td>
                      </Tr>
                    );
                  })}
                </TBody>
              </Table>
            </div>
            <ul className="divide-y divide-slate-100 sm:hidden">
              {data.results.map((e) => {
                const meta = eventLabel(e.event_type);
                return (
                  <li key={e.id} className="space-y-1 px-4 py-3">
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    <p className="text-xs text-slate-500">
                      {[
                        formatDateTime(e.created_at),
                        e.ip_address,
                        describeDevice(e.user_agent).label,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </li>
                );
              })}
            </ul>
            <Pagination page={page} count={data.count} onChange={setPage} />
          </>
        )}
      </QueryState>
    </Card>
  );
}

function DeactivateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [deactivate, { isLoading }] = useDeactivateAccountMutation();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const toast = useToast();

  const close = () => {
    setPassword("");
    setError(undefined);
    onClose();
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!password) {
      setError("Enter your password to confirm.");
      return;
    }
    try {
      await deactivate({ password }).unwrap();
      dispatch(signedOut());
      router.replace("/login");
      toast.info("Your account has been deactivated.");
    } catch (err) {
      const fields = getFieldErrors(err);
      if (fields.password) setError(fields.password);
      else toast.error(err);
    }
  };

  return (
    <Dialog open={open} onClose={close} title="Deactivate your account?" size="sm">
      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2 text-sm text-slate-600">
          <p>Deactivating will:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>sign you out of every device,</li>
            <li>
              revoke every caregiver grant and share link you&apos;ve created — they won&apos;t be
              restored if you reactivate.
            </li>
          </ul>
          <p>You can request reactivation later from the sign-in page.</p>
        </div>
        <Field label="Password" required error={error}>
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(undefined);
            }}
          />
        </Field>
        <FormActions>
          <Button variant="secondary" onClick={close} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" loading={isLoading}>
            Deactivate account
          </Button>
        </FormActions>
      </form>
    </Dialog>
  );
}

export function SecurityPage() {
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Security"
        description="Manage your password, signed-in devices and account access."
        back={{ href: "/settings", label: "Settings" }}
      />
      <Card>
        <CardHeader
          title="Change password"
          description="Changing your password signs out your other devices."
        />
        <CardBody>
          <ChangePasswordForm />
        </CardBody>
      </Card>
      <SessionsCard />
      <ActivityCard />
      <Card className="border-red-200">
        <CardHeader title="Danger zone" className="border-red-100" />
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900">Deactivate account</p>
            <p className="text-sm text-slate-500">
              Temporarily disable your account and all access to your health information.
            </p>
          </div>
          <Button variant="danger" onClick={() => setDeactivateOpen(true)}>
            Deactivate account
          </Button>
        </CardBody>
      </Card>
      <DeactivateDialog open={deactivateOpen} onClose={() => setDeactivateOpen(false)} />
    </div>
  );
}
