"use client";

import { Check, Copy, ShieldAlert } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";

import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  Field,
  FormActions,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { useToast } from "@/hooks/useToast";
import { getErrorMessage, getFieldErrors } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/format";
import { useCreateShareMutation } from "@/services/sharing";
import type { CreatedShare, PatientProfile } from "@/types/api";

import { DEFAULT_SCOPES, DURATIONS, SCOPES, SCOPE_LABELS, type Scope } from "./constants";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Create a time-limited, read-only share link for a provider. The link is
 * shown exactly once — it lives only in this component's state and is
 * discarded when the dialog closes.
 */
export function CreateShareDialog({
  open,
  onClose,
  profiles,
  defaultProfileId,
}: {
  open: boolean;
  onClose: () => void;
  profiles: PatientProfile[];
  defaultProfileId?: string;
}) {
  const [created, setCreated] = useState<CreatedShare | null>(null);
  const close = () => {
    setCreated(null);
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={close}
      title={created ? "Share link created" : "Share health information"}
      description={
        created
          ? undefined
          : "Create a secure, read-only link for a doctor or clinic. It expires automatically and you can revoke it at any time."
      }
      size="lg"
    >
      {open &&
        (created ? (
          <ShareLinkResult share={created} onDone={close} />
        ) : (
          <ShareForm
            profiles={profiles}
            defaultProfileId={defaultProfileId}
            onCreated={setCreated}
            onCancel={close}
          />
        ))}
    </Dialog>
  );
}

function ShareForm({
  profiles,
  defaultProfileId,
  onCreated,
  onCancel,
}: {
  profiles: PatientProfile[];
  defaultProfileId?: string;
  onCreated: (share: CreatedShare) => void;
  onCancel: () => void;
}) {
  const initialProfile =
    profiles.find((p) => p.id === defaultProfileId)?.id ??
    profiles.find((p) => p.is_self)?.id ??
    profiles[0]?.id ??
    "";
  const [profile, setProfile] = useState(initialProfile);
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [scopes, setScopes] = useState<Scope[]>(DEFAULT_SCOPES);
  const [duration, setDuration] = useState("72");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [createShare, { isLoading, error }] = useCreateShareMutation();
  const hasFieldErrors = Object.keys(getFieldErrors(error)).length > 0;

  const toggleScope = (scope: Scope, checked: boolean) =>
    setScopes((prev) =>
      SCOPES.map((s) => s.value).filter((s) => (s === scope ? checked : prev.includes(s))),
    );

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    const email = recipientEmail.trim();
    if (!profile) next.profile = "Choose whose information to share.";
    if (!recipientName.trim()) next.recipient_name = "Enter who you're sharing with.";
    if (email && !EMAIL_RE.test(email)) next.recipient_email = "Enter a valid email address.";
    if (sendEmail && !email) next.recipient_email = "Enter an email address to send the link to.";
    if (!scopes.length) next.scopes = "Choose at least one type of information to share.";
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      const share = await createShare({
        profile,
        recipient_name: recipientName.trim(),
        recipient_email: email || undefined,
        purpose: purpose.trim(),
        scopes,
        duration_hours: Number(duration),
        send_email: sendEmail && Boolean(email),
      }).unwrap();
      onCreated(share);
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
        <Field
          label="Recipient name"
          required
          error={errors.recipient_name}
          hint="e.g. Dr. Mehta, City Clinic"
        >
          <Input
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            maxLength={150}
          />
        </Field>
        <Field label="Recipient email" error={errors.recipient_email} hint="Optional">
          <Input
            type="email"
            autoComplete="off"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
          />
        </Field>
      </div>
      <Checkbox
        label="Email them the link"
        description="We'll send the link to the recipient's email address."
        checked={sendEmail}
        onChange={(e) => setSendEmail(e.target.checked)}
      />
      <Field
        label="Purpose"
        error={errors.purpose}
        hint="Shown to the recipient, e.g. “Second opinion on knee surgery”"
      >
        <Textarea
          rows={2}
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          maxLength={255}
        />
      </Field>
      <fieldset className="space-y-2" aria-describedby={errors.scopes ? "scope-error" : undefined}>
        <legend className="text-sm font-medium text-slate-800">
          What to share
          <span className="text-red-600" aria-hidden="true">
            {" "}
            *
          </span>
        </legend>
        <div className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
          {SCOPES.map((scope) => (
            <Checkbox
              key={scope.value}
              label={scope.label}
              description={scope.description}
              checked={scopes.includes(scope.value)}
              onChange={(e) => toggleScope(scope.value, e.target.checked)}
            />
          ))}
        </div>
        {errors.scopes && (
          <p id="scope-error" role="alert" className="text-xs font-medium text-red-700">
            {errors.scopes}
          </p>
        )}
      </fieldset>
      <Field label="Link expires after" required error={errors.duration_hours}>
        <Select
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          options={DURATIONS.map((d) => ({ value: String(d.hours), label: d.label }))}
        />
      </Field>
      <FormActions>
        <Button variant="secondary" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" loading={isLoading}>
          Create share link
        </Button>
      </FormActions>
    </form>
  );
}

function ShareLinkResult({ share, onDone }: { share: CreatedShare; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(share.share_url);
      setCopied(true);
      toast.success("Link copied to clipboard.");
    } catch {
      wrapRef.current?.querySelector("input")?.select();
      toast.info("Select the link and copy it manually.");
    }
  };

  return (
    <div className="space-y-4">
      <Alert tone="warning" title="Copy this link now — it won't be shown again">
        Anyone who has this link can view the shared information until it expires on{" "}
        <strong>{formatDateTime(share.expires_at)}</strong> or you revoke it. Send it only to{" "}
        {share.recipient_name}.
      </Alert>
      <div ref={wrapRef}>
        <Field label="Share link">
          <Input
            readOnly
            value={share.share_url}
            onFocus={(e) => e.target.select()}
            className="font-mono text-xs"
          />
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={copy}
          variant={copied ? "secondary" : "primary"}
          icon={
            copied ? (
              <Check className="size-4" aria-hidden />
            ) : (
              <Copy className="size-4" aria-hidden />
            )
          }
        >
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
      <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
        <p className="flex items-center gap-2 font-medium text-slate-900">
          <ShieldAlert className="text-brand-700 size-4" aria-hidden /> Shared with{" "}
          {share.recipient_name}
        </p>
        <p className="mt-1">{share.scopes.map((s) => SCOPE_LABELS[s] ?? s).join(", ")}</p>
        {share.recipient_email && (
          <p className="mt-1 text-xs text-slate-500">Recipient email: {share.recipient_email}</p>
        )}
        <p className="mt-1 text-xs text-slate-500">
          Every view is logged. You can see the access log on the share&apos;s page.
        </p>
      </div>
      <FormActions>
        <Button onClick={onDone}>Done</Button>
      </FormActions>
    </div>
  );
}
