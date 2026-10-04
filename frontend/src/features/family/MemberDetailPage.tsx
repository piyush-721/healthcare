"use client";

import { LayoutDashboard, Mail, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  DetailList,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@/components/ui";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useToast } from "@/hooks/useToast";
import { formatDate, humanize } from "@/lib/format";
import { useFamilyQuery } from "@/services/family";
import { useDeleteProfileMutation, useProfileQuery } from "@/services/profiles";
import { useAppDispatch } from "@/store/hooks";
import { activeProfileChanged } from "@/store/slices/profileSlice";

import { BLOOD_TYPE_LABELS, SEX_LABELS } from "../health-profile/config";
import { InviteCaregiverDialog } from "./CaregiverDialogs";
import { describePermissions } from "./permissions";
import { AccessStatusBadge, Avatar, PermissionList } from "./shared";

export function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const query = useProfileQuery(id, { skip: !id });
  const family = useFamilyQuery();
  const { profile: active, profiles } = useActiveProfile();
  const [deleteProfile, { isLoading: deleting }] = useDeleteProfileMutation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const toast = useToast();

  const back = { href: "/family", label: "Family" };
  if (query.isLoading) return <LoadingState />;
  if (query.error || !query.data) {
    return (
      <div>
        <PageHeader title="Family member" back={back} />
        <Card>
          <ErrorState error={query.error} onRetry={query.refetch} />
        </Card>
      </div>
    );
  }

  const profile = query.data;
  const isOwner = profile.access_role === "OWNER";
  const caregivers = (family.data?.caregivers ?? []).filter((a) => a.profile === profile.id);
  const permissionLabels = describePermissions(profile.permissions);

  const openDashboard = () => {
    dispatch(activeProfileChanged(profile.is_self ? null : profile.id));
    router.push("/dashboard");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        back={back}
        title={profile.full_name}
        badge={
          <Badge tone={isOwner ? "brand" : "neutral"}>
            {isOwner ? "You manage" : "Shared with you"}
          </Badge>
        }
        description={
          profile.is_self
            ? "Your own profile"
            : isOwner
              ? humanize(profile.relationship_to_owner)
              : `Shared with you by ${profile.owner_name}`
        }
        actions={
          <>
            <Button
              onClick={openDashboard}
              icon={<LayoutDashboard className="size-4" aria-hidden />}
            >
              Open their dashboard
            </Button>
            {isOwner && !profile.is_self && (
              <Button
                variant="secondary"
                className="text-red-700"
                onClick={() => setConfirmOpen(true)}
                icon={<Trash2 className="size-4" aria-hidden />}
              >
                Delete profile
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Profile" />
          <CardBody>
            <div className="mb-3 flex items-center gap-3">
              <Avatar name={profile.full_name} tone="brand" />
              <div>
                <p className="text-sm font-medium text-slate-900">{profile.full_name}</p>
                <p className="text-xs text-slate-500">Managed by {profile.owner_name}</p>
              </div>
            </div>
            <DetailList
              items={[
                {
                  label: "Relationship",
                  value: profile.is_self ? "Self" : humanize(profile.relationship_to_owner),
                },
                {
                  label: "Date of birth",
                  value: profile.date_of_birth ? formatDate(profile.date_of_birth) : null,
                },
                {
                  label: "Sex",
                  value: profile.sex ? (SEX_LABELS[profile.sex] ?? humanize(profile.sex)) : null,
                },
                {
                  label: "Blood type",
                  value: profile.blood_type ? BLOOD_TYPE_LABELS[profile.blood_type] : null,
                },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Your access"
            description={
              isOwner
                ? "As the owner you have full access."
                : "What the owner has allowed you to do."
            }
          />
          <CardBody>
            <p className="mb-3 text-sm text-slate-700">
              Role: <strong>{isOwner ? "Owner" : "Caregiver"}</strong>
            </p>
            <PermissionList labels={permissionLabels} />
          </CardBody>
        </Card>
      </div>

      {isOwner && (
        <Card>
          <CardHeader
            title="Caregivers on this profile"
            action={
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setInviteOpen(true)}
                icon={<Mail className="size-4" aria-hidden />}
              >
                Invite caregiver
              </Button>
            }
          />
          {family.isLoading ? (
            <LoadingState />
          ) : family.error ? (
            <ErrorState error={family.error} onRetry={family.refetch} />
          ) : caregivers.length === 0 ? (
            <EmptyState
              title="No caregivers"
              description={`No one else has access to ${profile.is_self ? "your" : `${profile.full_name}'s`} health information.`}
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {caregivers.map((a) => (
                <li key={a.id} className="space-y-2 px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-slate-900">
                      {a.caregiver_name || a.invite_email}
                    </p>
                    <AccessStatusBadge access={a} />
                    {a.relationship && (
                      <span className="text-xs text-slate-500">{a.relationship}</span>
                    )}
                  </div>
                  <PermissionList labels={describePermissions(a.permissions)} />
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:px-5">
            Edit or revoke caregiver access from the Family page.
          </p>
        </Card>
      )}

      {isOwner && (
        <InviteCaregiverDialog
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          profiles={profiles.filter((p) => p.access_role === "OWNER")}
          defaultProfileId={profile.id}
        />
      )}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={`Delete ${profile.full_name}'s profile?`}
        message={
          <>
            This permanently deletes {profile.full_name}&apos;s profile and all of their health
            information — records, documents, medications, appointments and lab reports. Caregivers
            will lose access. This can&apos;t be undone.
          </>
        }
        confirmLabel="Delete profile"
        loading={deleting}
        onConfirm={async () => {
          try {
            await deleteProfile(profile.id).unwrap();
            if (active?.id === profile.id) dispatch(activeProfileChanged(null));
            toast.success(`${profile.full_name}'s profile was deleted.`);
            setConfirmOpen(false);
            router.replace("/family");
          } catch (err) {
            toast.error(err);
          }
        }}
      />
    </div>
  );
}
