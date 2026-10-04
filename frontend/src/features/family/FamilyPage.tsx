"use client";

import { ChevronRight, HeartHandshake, Mail, Pencil, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  Alert,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  LinkButton,
  PageHeader,
  QueryState,
  Skeleton,
} from "@/components/ui";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useToast } from "@/hooks/useToast";
import { formatDate, humanize } from "@/lib/format";
import {
  useFamilyQuery,
  useLeaveCaregivingMutation,
  useRevokeCaregiverMutation,
} from "@/services/family";
import { useAppDispatch } from "@/store/hooks";
import { activeProfileChanged } from "@/store/slices/profileSlice";
import type { CaregiverAccess, FamilyOverview } from "@/types/api";

import { AddDependentDialog } from "./AddDependentDialog";
import { EditCaregiverDialog, InviteCaregiverDialog } from "./CaregiverDialogs";
import { describePermissions } from "./permissions";
import { AccessStatusBadge, Avatar, PermissionList } from "./shared";

function FamilySkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading family">
      {[0, 1, 2].map((i) => (
        <Card key={i} className="space-y-3 p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </Card>
      ))}
    </div>
  );
}

function DependentsSection({ data, onAdd }: { data: FamilyOverview; onAdd: () => void }) {
  return (
    <Card>
      <CardHeader
        title="Family members you manage"
        description="Profiles you look after as a guardian, such as children or parents."
        action={
          <Button
            size="sm"
            variant="secondary"
            onClick={onAdd}
            icon={<UserPlus className="size-4" aria-hidden />}
          >
            <span className="max-sm:sr-only">Add family member</span>
          </Button>
        }
      />
      {data.dependents.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No family members yet"
          description="Add a child, parent or anyone you look after to keep their health information organized."
          action={<Button onClick={onAdd}>Add family member</Button>}
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {data.dependents.map((p) => (
            <li key={p.id}>
              <Link
                href={`/family/${p.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 sm:px-5"
              >
                <Avatar name={p.full_name} tone="brand" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900">
                    {p.full_name}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {humanize(p.relationship_to_owner)}
                    {p.date_of_birth ? ` · Born ${formatDate(p.date_of_birth)}` : ""}
                  </span>
                </span>
                <ChevronRight className="size-4 text-slate-400" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function CaregiversSection({
  caregivers,
  onInvite,
  onEdit,
  onRevoke,
}: {
  caregivers: CaregiverAccess[];
  onInvite: () => void;
  onEdit: (a: CaregiverAccess) => void;
  onRevoke: (a: CaregiverAccess) => void;
}) {
  return (
    <Card>
      <CardHeader
        title="Caregivers"
        description="People you've given access to your or your family's health information."
        action={
          <Button
            size="sm"
            variant="secondary"
            onClick={onInvite}
            icon={<Mail className="size-4" aria-hidden />}
          >
            <span className="max-sm:sr-only">Invite caregiver</span>
          </Button>
        }
      />
      {caregivers.length === 0 ? (
        <EmptyState
          icon={HeartHandshake}
          title="No caregivers"
          description="Invite a spouse, family member or carer to help manage health information — with only the permissions you choose."
          action={<Button onClick={onInvite}>Invite a caregiver</Button>}
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {caregivers.map((a) => {
            const name = a.caregiver_name || a.invite_email;
            return (
              <li key={a.id} className="space-y-2 px-4 py-4 sm:px-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <Avatar name={name} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-slate-900">{name}</p>
                        <AccessStatusBadge access={a} />
                      </div>
                      <p className="text-xs text-slate-500">
                        {[
                          `For ${a.profile_name}`,
                          a.relationship,
                          a.caregiver_name ? a.invite_email : null,
                          a.expires_at ? `Access ends ${formatDate(a.expires_at)}` : null,
                          a.status === "PENDING"
                            ? `Invite expires ${formatDate(a.invite_expires_at)}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2 sm:pl-0">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onEdit(a)}
                      icon={<Pencil className="size-4" aria-hidden />}
                      aria-label={`Edit access for ${name}`}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-700 hover:bg-red-50"
                      onClick={() => onRevoke(a)}
                      aria-label={`Revoke access for ${name}`}
                    >
                      Revoke
                    </Button>
                  </div>
                </div>
                <div className="sm:pl-[3.25rem]">
                  <PermissionList labels={describePermissions(a.permissions)} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function CaringForSection({
  caringFor,
  onView,
  onLeave,
}: {
  caringFor: CaregiverAccess[];
  onView: (a: CaregiverAccess) => void;
  onLeave: (a: CaregiverAccess) => void;
}) {
  return (
    <Card>
      <CardHeader
        title="People you care for"
        description="Health information others have shared with you."
      />
      {caringFor.length === 0 ? (
        <EmptyState
          icon={HeartHandshake}
          title="No one has shared with you yet"
          description="When someone invites you as their caregiver and you accept, they'll appear here."
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {caringFor.map((a) => (
            <li key={a.id} className="space-y-2 px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <Avatar name={a.profile_name} />
                  <div className="min-w-0">
                    <Link
                      href={`/family/${a.profile}`}
                      className="text-sm font-medium text-slate-900 hover:underline"
                    >
                      {a.profile_name}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {[
                        `Shared by ${a.granted_by_name}`,
                        a.relationship,
                        a.expires_at ? `Access ends ${formatDate(a.expires_at)}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    onClick={() => onView(a)}
                    aria-label={`View ${a.profile_name}'s dashboard`}
                  >
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-700 hover:bg-red-50"
                    onClick={() => onLeave(a)}
                    aria-label={`Stop caring for ${a.profile_name}`}
                  >
                    Leave
                  </Button>
                </div>
              </div>
              <div className="sm:pl-[3.25rem]">
                <PermissionList labels={describePermissions(a.permissions)} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function FamilyPage() {
  const query = useFamilyQuery();
  const { profiles, profile: active } = useActiveProfile();
  const ownedProfiles = profiles.filter((p) => p.access_role === "OWNER");
  const [addOpen, setAddOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<CaregiverAccess | null>(null);
  const [revoking, setRevoking] = useState<CaregiverAccess | null>(null);
  const [leaving, setLeaving] = useState<CaregiverAccess | null>(null);
  const [revoke, { isLoading: revokeBusy }] = useRevokeCaregiverMutation();
  const [leave, { isLoading: leaveBusy }] = useLeaveCaregivingMutation();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const toast = useToast();

  const viewProfile = (profileId: string) => {
    dispatch(activeProfileChanged(profileId));
    router.push("/dashboard");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Family & caregivers"
        description="Manage the people whose health you look after, and who can help look after yours."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => setInviteOpen(true)}
              icon={<Mail className="size-4" aria-hidden />}
            >
              Invite caregiver
            </Button>
            <Button
              onClick={() => setAddOpen(true)}
              icon={<UserPlus className="size-4" aria-hidden />}
            >
              Add family member
            </Button>
          </>
        }
      />
      <QueryState query={query} loading={<FamilySkeleton />}>
        {(data) => (
          <div className="space-y-6">
            {data.pending_invitations.length > 0 && (
              <Alert
                tone="info"
                title={`You have ${data.pending_invitations.length} pending caregiver invitation${
                  data.pending_invitations.length === 1 ? "" : "s"
                }`}
                action={
                  <LinkButton href="/family/invitations" size="sm" variant="secondary">
                    Review
                  </LinkButton>
                }
              >
                Review what you&apos;re being asked to help with before accepting.
              </Alert>
            )}
            <DependentsSection data={data} onAdd={() => setAddOpen(true)} />
            <CaregiversSection
              caregivers={data.caregivers}
              onInvite={() => setInviteOpen(true)}
              onEdit={setEditing}
              onRevoke={setRevoking}
            />
            <CaringForSection
              caringFor={data.caring_for}
              onView={(a) => viewProfile(a.profile)}
              onLeave={setLeaving}
            />
          </div>
        )}
      </QueryState>

      <AddDependentDialog open={addOpen} onClose={() => setAddOpen(false)} />
      <InviteCaregiverDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        profiles={ownedProfiles}
        defaultProfileId={active?.access_role === "OWNER" ? active.id : undefined}
      />
      <EditCaregiverDialog access={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        title={revoking?.status === "PENDING" ? "Cancel invitation?" : "Revoke caregiver access?"}
        message={
          revoking && (
            <>
              <strong className="text-slate-900">
                {revoking.caregiver_name || revoking.invite_email}
              </strong>{" "}
              will immediately lose access to {revoking.profile_name}&apos;s health information. You
              can invite them again later.
            </>
          )
        }
        confirmLabel={revoking?.status === "PENDING" ? "Cancel invitation" : "Revoke access"}
        loading={revokeBusy}
        onConfirm={async () => {
          if (!revoking) return;
          try {
            await revoke(revoking.id).unwrap();
            toast.success("Access revoked.");
            setRevoking(null);
          } catch (err) {
            toast.error(err);
          }
        }}
      />
      <ConfirmDialog
        open={leaving !== null}
        onClose={() => setLeaving(null)}
        title="Stop caring for this person?"
        message={
          leaving && (
            <>
              You&apos;ll no longer be able to see or manage{" "}
              <strong className="text-slate-900">{leaving.profile_name}</strong>&apos;s health
              information. They would need to invite you again to restore access.
            </>
          )
        }
        confirmLabel="Leave"
        loading={leaveBusy}
        onConfirm={async () => {
          if (!leaving) return;
          try {
            await leave(leaving.id).unwrap();
            if (active?.id === leaving.profile) dispatch(activeProfileChanged(null));
            toast.success(`You're no longer a caregiver for ${leaving.profile_name}.`);
            setLeaving(null);
          } catch (err) {
            toast.error(err);
          }
        }}
      />
    </div>
  );
}
