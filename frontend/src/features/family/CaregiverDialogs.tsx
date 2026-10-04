"use client";

import { useState, type FormEvent } from "react";

import { Alert, Button, Dialog, Field, FormActions, Input, Select } from "@/components/ui";
import { useToast } from "@/hooks/useToast";
import { getErrorMessage, getFieldErrors } from "@/lib/api/errors";
import { todayISO } from "@/lib/format";
import { useInviteCaregiverMutation, useUpdateCaregiverMutation } from "@/services/family";
import type { CaregiverAccess, PatientProfile, Permission } from "@/types/api";

import { PermissionPicker } from "./PermissionPicker";
import { isPermission } from "./permissions";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "YYYY-MM-DD" (local) → ISO timestamp at the end of that day. */
export function endOfDayISO(date: string): string {
  return new Date(`${date}T23:59:59`).toISOString();
}

function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const offset = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

function validateEndDate(date: string): string | undefined {
  if (date && date <= todayISO()) return "Choose a date after today.";
  return undefined;
}

export function InviteCaregiverDialog({
  open,
  onClose,
  profiles,
  defaultProfileId,
}: {
  open: boolean;
  onClose: () => void;
  /** Profiles the user owns (self + dependents). */
  profiles: PatientProfile[];
  defaultProfileId?: string;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Invite a caregiver"
      description="They'll get an email invitation and can only see what you allow. You can change or revoke access at any time."
      size="lg"
    >
      {open && (
        <InviteForm profiles={profiles} defaultProfileId={defaultProfileId} onDone={onClose} />
      )}
    </Dialog>
  );
}

function InviteForm({
  profiles,
  defaultProfileId,
  onDone,
}: {
  profiles: PatientProfile[];
  defaultProfileId?: string;
  onDone: () => void;
}) {
  const initialProfile =
    profiles.find((p) => p.id === defaultProfileId)?.id ??
    profiles.find((p) => p.is_self)?.id ??
    profiles[0]?.id ??
    "";
  const [profile, setProfile] = useState(initialProfile);
  const [email, setEmail] = useState("");
  const [relationship, setRelationship] = useState("");
  const [permissions, setPermissions] = useState<Permission[]>(["VIEW_PROFILE"]);
  const [endDate, setEndDate] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [invite, { isLoading, error }] = useInviteCaregiverMutation();
  const toast = useToast();
  const hasFieldErrors = Object.keys(getFieldErrors(error)).length > 0;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!profile) next.profile = "Choose whose information to share.";
    if (!EMAIL_RE.test(email.trim())) next.email = "Enter a valid email address.";
    if (!permissions.length) next.permissions = "Choose at least one permission.";
    const dateError = validateEndDate(endDate);
    if (dateError) next.expires_at = dateError;
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      await invite({
        profile,
        email: email.trim(),
        relationship: relationship.trim(),
        permissions,
        expires_at: endDate ? endOfDayISO(endDate) : null,
      }).unwrap();
      toast.success(`Invitation sent to ${email.trim()}.`);
      onDone();
    } catch (err) {
      setErrors(getFieldErrors(err));
    }
  };

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-4">
      {error && !hasFieldErrors ? <Alert tone="error">{getErrorMessage(error)}</Alert> : null}
      <Field label="Whose information" required error={errors.profile}>
        <Select
          value={profile}
          onChange={(e) => setProfile(e.target.value)}
          options={profiles.map((p) => ({
            value: p.id,
            label: p.is_self ? `${p.full_name} (you)` : p.full_name,
          }))}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Caregiver's email" required error={errors.email}>
          <Input
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field
          label="Relationship"
          hint="e.g. Spouse, daughter, home nurse"
          error={errors.relationship}
        >
          <Input
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            maxLength={60}
          />
        </Field>
      </div>
      <PermissionPicker
        value={permissions}
        onChange={setPermissions}
        error={errors.permissions}
        disabled={isLoading}
      />
      <Field
        label="Access ends on"
        hint="Optional. Leave blank to keep access until you revoke it."
        error={errors.expires_at}
      >
        <Input
          type="date"
          min={todayISO()}
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
      </Field>
      <FormActions>
        <Button variant="secondary" onClick={onDone} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" loading={isLoading}>
          Send invitation
        </Button>
      </FormActions>
    </form>
  );
}

export function EditCaregiverDialog({
  access,
  onClose,
}: {
  access: CaregiverAccess | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={access !== null}
      onClose={onClose}
      title="Edit caregiver access"
      description={
        access
          ? `${access.caregiver_name || access.invite_email} · ${access.profile_name}`
          : undefined
      }
      size="lg"
    >
      {access && <EditForm key={access.id} access={access} onDone={onClose} />}
    </Dialog>
  );
}

function EditForm({ access, onDone }: { access: CaregiverAccess; onDone: () => void }) {
  const [relationship, setRelationship] = useState(access.relationship);
  const [permissions, setPermissions] = useState<Permission[]>(
    access.permissions.filter(isPermission),
  );
  const [endDate, setEndDate] = useState(isoToDateInput(access.expires_at));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [update, { isLoading, error }] = useUpdateCaregiverMutation();
  const toast = useToast();
  const hasFieldErrors = Object.keys(getFieldErrors(error)).length > 0;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!permissions.length)
      next.permissions = "Choose at least one permission. To remove all access, revoke it instead.";
    const original = isoToDateInput(access.expires_at);
    const dateError = endDate !== original ? validateEndDate(endDate) : undefined;
    if (dateError) next.expires_at = dateError;
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      await update({
        id: access.id,
        relationship: relationship.trim(),
        permissions,
        expires_at: endDate
          ? endDate === original
            ? access.expires_at
            : endOfDayISO(endDate)
          : null,
      }).unwrap();
      toast.success("Caregiver access updated.");
      onDone();
    } catch (err) {
      setErrors(getFieldErrors(err));
    }
  };

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-4">
      {error && !hasFieldErrors ? <Alert tone="error">{getErrorMessage(error)}</Alert> : null}
      <Field label="Relationship" error={errors.relationship}>
        <Input
          value={relationship}
          onChange={(e) => setRelationship(e.target.value)}
          maxLength={60}
        />
      </Field>
      <PermissionPicker
        value={permissions}
        onChange={setPermissions}
        error={errors.permissions}
        disabled={isLoading}
      />
      <Field
        label="Access ends on"
        hint="Leave blank to keep access until you revoke it."
        error={errors.expires_at}
      >
        <Input
          type="date"
          min={todayISO()}
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
      </Field>
      <FormActions>
        <Button variant="secondary" onClick={onDone} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" loading={isLoading}>
          Save changes
        </Button>
      </FormActions>
    </form>
  );
}
