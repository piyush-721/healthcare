"use client";

import { Check, Inbox, X } from "lucide-react";
import { useState } from "react";

import {
  Button,
  Card,
  CardBody,
  ConfirmDialog,
  EmptyState,
  LinkButton,
  PageHeader,
  QueryState,
} from "@/components/ui";
import { useToast } from "@/hooks/useToast";
import { formatDate } from "@/lib/format";
import { useInvitationsQuery, useRespondToInvitationMutation } from "@/services/family";
import type { CaregiverAccess } from "@/types/api";

import { describePermissions } from "./permissions";
import { Avatar } from "./shared";

function InvitationCard({
  invitation,
  onAccept,
  onDecline,
  busy,
}: {
  invitation: CaregiverAccess;
  onAccept: () => void;
  onDecline: () => void;
  busy: "accept" | "decline" | null;
}) {
  const labels = describePermissions(invitation.permissions);
  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex items-start gap-3">
          <Avatar name={invitation.granted_by_name} tone="brand" />
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">
              {invitation.granted_by_name} invited you to help with {invitation.profile_name}&apos;s
              health information
            </h2>
            <p className="text-sm text-slate-500">
              {[
                invitation.relationship ? `Relationship: ${invitation.relationship}` : null,
                `Invitation expires ${formatDate(invitation.invite_expires_at)}`,
                invitation.expires_at
                  ? `Access would end ${formatDate(invitation.expires_at)}`
                  : "No end date",
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium text-slate-800">
            If you accept, you&apos;ll be able to:
          </h3>
          {labels.length ? (
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {labels.map((label) => (
                <li key={label} className="flex items-center gap-2 text-sm text-slate-700">
                  <Check className="text-brand-700 size-4 shrink-0" aria-hidden />
                  {label}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No permissions were included.</p>
          )}
          <p className="mt-2 text-xs text-slate-500">
            You won&apos;t be able to see or change anything else.
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            onClick={onDecline}
            disabled={busy !== null}
            icon={<X className="size-4" aria-hidden />}
          >
            Decline
          </Button>
          <Button
            onClick={onAccept}
            loading={busy === "accept"}
            disabled={busy !== null}
            icon={<Check className="size-4" aria-hidden />}
          >
            Accept invitation
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

export function InvitationsPage() {
  const query = useInvitationsQuery();
  const [respond] = useRespondToInvitationMutation();
  const [busy, setBusy] = useState<{ id: string; action: "accept" | "decline" } | null>(null);
  const [declining, setDeclining] = useState<CaregiverAccess | null>(null);
  const toast = useToast();

  const answer = async (invitation: CaregiverAccess, accept: boolean) => {
    setBusy({ id: invitation.id, action: accept ? "accept" : "decline" });
    try {
      await respond({ id: invitation.id, accept }).unwrap();
      toast.success(
        accept
          ? `You're now a caregiver for ${invitation.profile_name}. Switch to their profile from the profile menu.`
          : "Invitation declined.",
      );
      setDeclining(null);
    } catch (err) {
      toast.error(err);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Caregiver invitations"
        description="People who'd like your help managing their health information."
        back={{ href: "/family", label: "Family" }}
      />
      <QueryState
        query={query}
        isEmpty={(data) => data.length === 0}
        empty={
          <Card>
            <EmptyState
              icon={Inbox}
              title="No pending invitations"
              description="When someone invites you to be their caregiver, the invitation will appear here."
              action={
                <LinkButton href="/family" variant="secondary">
                  Back to family
                </LinkButton>
              }
            />
          </Card>
        }
      >
        {(invitations) => (
          <ul className="space-y-4">
            {invitations.map((inv) => (
              <li key={inv.id}>
                <InvitationCard
                  invitation={inv}
                  busy={busy?.id === inv.id ? busy.action : null}
                  onAccept={() => answer(inv, true)}
                  onDecline={() => setDeclining(inv)}
                />
              </li>
            ))}
          </ul>
        )}
      </QueryState>
      <ConfirmDialog
        open={declining !== null}
        onClose={() => setDeclining(null)}
        title="Decline invitation?"
        message={
          declining && (
            <>
              You won&apos;t get access to {declining.profile_name}&apos;s health information. They
              can invite you again later.
            </>
          )
        }
        confirmLabel="Decline"
        loading={busy?.action === "decline"}
        onConfirm={() => declining && answer(declining, false)}
      />
    </div>
  );
}
