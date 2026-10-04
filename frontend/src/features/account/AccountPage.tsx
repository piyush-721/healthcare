"use client";

import { BadgeCheck } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  FormActions,
  Input,
  LinkButton,
  PageHeader,
  QueryState,
  Select,
} from "@/components/ui";
import { useToast } from "@/hooks/useToast";
import { getFieldErrors } from "@/lib/api/errors";
import { formatDate } from "@/lib/format";
import { useMeQuery, useUpdateMeMutation } from "@/services/auth";
import { useAppDispatch } from "@/store/hooks";
import { userUpdated } from "@/store/slices/authSlice";
import type { User } from "@/types/api";

function timeZones(current: string): string[] {
  let zones: string[] = [];
  try {
    zones = Intl.supportedValuesOf("timeZone");
  } catch {
    zones = [];
  }
  if (!zones.includes("UTC")) zones = ["UTC", ...zones];
  if (current && !zones.includes(current)) zones = [current, ...zones];
  return zones;
}

function AccountForm({ user }: { user: User }) {
  const [fullName, setFullName] = useState(user.full_name);
  const [timezone, setTimezone] = useState(user.timezone || "UTC");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [updateMe, { isLoading }] = useUpdateMeMutation();
  const dispatch = useAppDispatch();
  const toast = useToast();
  const zones = useMemo(() => timeZones(user.timezone ?? ""), [user.timezone]);
  const browserZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!fullName.trim()) {
      setErrors({ full_name: "Enter your full name." });
      return;
    }
    setErrors({});
    try {
      const updated = await updateMe({ full_name: fullName.trim(), timezone }).unwrap();
      dispatch(userUpdated(updated));
      toast.success("Account details saved.");
    } catch (err) {
      const fieldErrors = getFieldErrors(err);
      setErrors(fieldErrors);
      if (!Object.keys(fieldErrors).length) toast.error(err);
    }
  };

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-4">
      <Field label="Full name" required error={errors.full_name}>
        <Input
          value={fullName}
          autoComplete="name"
          onChange={(e) => setFullName(e.target.value)}
          maxLength={150}
        />
      </Field>
      <Field label="Email" hint="Contact support to change the email address on your account.">
        <Input value={user.email} readOnly disabled type="email" />
      </Field>
      <div className="-mt-2 flex items-center gap-2">
        {user.email_verified ? (
          <Badge tone="success">
            <BadgeCheck className="size-3.5" aria-hidden /> Email verified
          </Badge>
        ) : (
          <Badge tone="warning">Email not verified</Badge>
        )}
      </div>
      <Field
        label="Time zone"
        required
        error={errors.timezone}
        hint="Reminders and “today” are calculated in this time zone."
      >
        <Select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          options={zones.map((z) => ({ value: z, label: z.replace(/_/g, " ") }))}
        />
      </Field>
      {browserZone && browserZone !== timezone && (
        <Button variant="link" size="sm" onClick={() => setTimezone(browserZone)}>
          Use this device&apos;s time zone ({browserZone.replace(/_/g, " ")})
        </Button>
      )}
      <FormActions>
        <Button type="submit" loading={isLoading}>
          Save changes
        </Button>
      </FormActions>
    </form>
  );
}

export function AccountPage() {
  const query = useMeQuery();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Account"
        description="Your sign-in details and preferences."
        actions={
          <LinkButton href="/settings/security" variant="secondary">
            Security settings
          </LinkButton>
        }
      />
      <Card className="max-w-2xl">
        <CardHeader title="Account details" />
        <CardBody>
          <QueryState query={query}>
            {(user) => (
              <>
                <AccountForm key={user.id} user={user} />
                <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  Member since {formatDate(user.date_joined)}
                </p>
              </>
            )}
          </QueryState>
        </CardBody>
      </Card>
    </div>
  );
}
