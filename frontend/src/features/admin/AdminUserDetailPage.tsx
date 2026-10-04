"use client";

import { Ban, RotateCcw, ShieldCheck, ShieldOff } from "lucide-react";
import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  DetailList,
  Dialog,
  EmptyState,
  Field,
  FormActions,
  PageHeader,
  Pagination,
  QueryState,
  Textarea,
} from "@/components/ui";
import { useToast } from "@/hooks/useToast";
import { formatDateTime } from "@/lib/format";
import {
  useAdminUserQuery,
  useAdminUserSecurityEventsQuery,
  useChangeUserRoleMutation,
  useReactivateUserMutation,
  useSuspendUserMutation,
} from "@/services/admin";
import { useAppSelector } from "@/store/hooks";
import type { AdminUserDetail } from "@/types/api";

import { AuditTable } from "./AuditLogsPage";
import { RoleBadge, UserStatusBadge, VerifiedBadge } from "./badges";

export function SuspendDialog({
  user,
  open,
  onClose,
}: {
  user: AdminUserDetail;
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const [suspend, { isLoading }] = useSuspendUserMutation();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>();

  const close = () => {
    setReason("");
    setError(undefined);
    onClose();
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reason.trim()) {
      setError("Enter a reason. It is recorded in the audit log.");
      return;
    }
    setError(undefined);
    try {
      await suspend({ id: user.id, reason: reason.trim() }).unwrap();
      toast.success(`${user.email} has been suspended.`);
      close();
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Suspend account"
      description={`${user.email} will be signed out everywhere and won't be able to sign in until reactivated.`}
      size="sm"
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field
          label="Reason"
          required
          error={error}
          hint="Recorded in the audit log. Don't include health information."
        >
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
          />
        </Field>
        <FormActions>
          <Button variant="secondary" onClick={close} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" loading={isLoading}>
            Suspend account
          </Button>
        </FormActions>
      </form>
    </Dialog>
  );
}

function SecurityEvents({ userId }: { userId: string }) {
  const [page, setPage] = useState(1);
  const query = useAdminUserSecurityEventsQuery({ id: userId, page });
  return (
    <Card>
      <CardHeader
        title="Security events"
        description="Sign-ins, session and account changes for this user."
      />
      <QueryState
        query={query}
        isEmpty={(d) => d.results.length === 0}
        empty={
          <EmptyState
            title="No security events"
            description="Nothing has been recorded for this account yet."
          />
        }
      >
        {(data) => (
          <>
            <AuditTable entries={data.results} showSubject={false} />
            <Pagination page={page} count={data.count} onChange={setPage} />
          </>
        )}
      </QueryState>
    </Card>
  );
}

function UserView({ user }: { user: AdminUserDetail }) {
  const toast = useToast();
  const currentUserId = useAppSelector((state) => state.auth.user?.id);
  const isSelf = currentUserId === user.id;
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [reactivate, { isLoading: reactivating }] = useReactivateUserMutation();
  const [changeRole, { isLoading: changingRole }] = useChangeUserRoleMutation();
  const nextRole = user.role === "ADMIN" ? "USER" : "ADMIN";

  const onReactivate = async () => {
    try {
      await reactivate(user.id).unwrap();
      toast.success(`${user.email} has been reactivated.`);
    } catch (err) {
      toast.error(err);
    } finally {
      setReactivateOpen(false);
    }
  };

  const onChangeRole = async () => {
    try {
      await changeRole({ id: user.id, role: nextRole }).unwrap();
      toast.success(
        nextRole === "ADMIN"
          ? `${user.email} is now an admin.`
          : `${user.email} is no longer an admin.`,
      );
    } catch (err) {
      toast.error(err);
    } finally {
      setRoleOpen(false);
    }
  };

  return (
    <>
      <PageHeader
        back={{ href: "/admin/users", label: "Users" }}
        title={user.full_name || user.email}
        badge={
          <>
            <UserStatusBadge status={user.status} />
            <RoleBadge role={user.role} />
          </>
        }
        description={user.full_name ? user.email : undefined}
        actions={
          <>
            {user.status === "ACTIVE" ? (
              <Button
                variant="danger"
                onClick={() => setSuspendOpen(true)}
                icon={<Ban className="size-4" aria-hidden />}
              >
                Suspend
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => setReactivateOpen(true)}
                icon={<RotateCcw className="size-4" aria-hidden />}
              >
                Reactivate
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => setRoleOpen(true)}
              icon={
                user.role === "ADMIN" ? (
                  <ShieldOff className="size-4" aria-hidden />
                ) : (
                  <ShieldCheck className="size-4" aria-hidden />
                )
              }
            >
              {user.role === "ADMIN" ? "Remove admin role" : "Make admin"}
            </Button>
          </>
        }
      />
      <div className="space-y-6">
        {isSelf && (
          <Alert tone="info" title="This is your account">
            You can&apos;t suspend your own account or remove your own admin role.
          </Alert>
        )}
        <Card>
          <CardHeader title="Account" />
          <CardBody className="py-1">
            <DetailList
              items={[
                { label: "Email", value: user.email },
                { label: "Name", value: user.full_name },
                { label: "Status", value: <UserStatusBadge status={user.status} /> },
                {
                  label: "Status changed",
                  value: user.status_changed_at ? formatDateTime(user.status_changed_at) : null,
                },
                { label: "Role", value: <RoleBadge role={user.role} /> },
                {
                  label: "Email verification",
                  value: <VerifiedBadge verified={user.email_verified} />,
                },
                { label: "Joined", value: formatDateTime(user.date_joined) },
                {
                  label: "Last login",
                  value: user.last_login ? formatDateTime(user.last_login) : "Never",
                },
                { label: "Active sessions", value: String(user.active_sessions) },
                { label: "Time zone", value: user.timezone },
              ]}
            />
          </CardBody>
        </Card>
        <SecurityEvents userId={user.id} />
      </div>

      <SuspendDialog user={user} open={suspendOpen} onClose={() => setSuspendOpen(false)} />
      <ConfirmDialog
        open={reactivateOpen}
        onClose={() => setReactivateOpen(false)}
        onConfirm={onReactivate}
        loading={reactivating}
        tone="primary"
        title="Reactivate account?"
        message={<>{user.email} will be able to sign in again.</>}
        confirmLabel="Reactivate"
      />
      <ConfirmDialog
        open={roleOpen}
        onClose={() => setRoleOpen(false)}
        onConfirm={onChangeRole}
        loading={changingRole}
        tone={nextRole === "ADMIN" ? "primary" : "danger"}
        title={nextRole === "ADMIN" ? "Grant admin role?" : "Remove admin role?"}
        message={
          <div className="space-y-2">
            <p>
              {nextRole === "ADMIN"
                ? `${user.email} will be able to use this admin console: view accounts and audit logs, suspend and reactivate users, and change roles.`
                : `${user.email} will lose access to this admin console.`}
            </p>
            <p>
              The admin role grants no access to anyone&apos;s health information — that stays
              private to each member and the people they share with.
            </p>
          </div>
        }
        confirmLabel={nextRole === "ADMIN" ? "Make admin" : "Remove admin role"}
      />
    </>
  );
}

export function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const query = useAdminUserQuery(id);
  return <QueryState query={query}>{(user) => <UserView user={user} />}</QueryState>;
}
