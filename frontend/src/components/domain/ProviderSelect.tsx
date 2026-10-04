"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";

import { Button, Dialog, Field, FormActions, Input, Select, toOptions } from "@/components/ui";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useToast } from "@/hooks/useToast";
import { getFieldErrors } from "@/lib/api/errors";
import { useCreateProviderMutation, useProvidersQuery } from "@/services/profiles";

const KINDS = ["DOCTOR", "CLINIC", "HOSPITAL", "LAB", "PHARMACY", "OTHER"] as const;

/**
 * Pick a saved doctor/clinic for the active profile, or add one inline.
 * Caregivers without profile permissions simply see no saved providers.
 */
export function ProviderSelect({
  value,
  onChange,
  label = "Doctor / provider",
  error,
}: {
  value: string | null | undefined;
  onChange: (id: string | null) => void;
  label?: string;
  error?: string;
}) {
  const { profileId, can } = useActiveProfile();
  const canView = can("VIEW_PROFILE");
  const { data } = useProvidersQuery({ profile: profileId }, { skip: !canView });
  const [create, { isLoading, error: createError }] = useCreateProviderMutation();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", kind: "DOCTOR", specialty: "", organization: "" });
  const toast = useToast();
  const fieldErrors = getFieldErrors(createError);

  const options = (data?.results ?? []).map((p) => ({
    value: p.id,
    label: [p.name, p.specialty || p.organization].filter(Boolean).join(" · "),
  }));

  return (
    <div>
      <div className="flex items-end gap-2">
        <Field label={label} error={error} className="flex-1">
          <Select
            value={value ?? ""}
            onChange={(event) => onChange(event.target.value || null)}
            options={options}
            placeholder={canView ? "None selected" : "Not available"}
            disabled={!canView}
          />
        </Field>
        {can("MANAGE_PROFILE") && (
          <Button
            variant="secondary"
            onClick={() => setOpen(true)}
            aria-label="Add a new provider"
            icon={<Plus className="size-4" aria-hidden />}
          >
            <span className="max-sm:sr-only">New</span>
          </Button>
        )}
      </div>
      {/* Portalled so this form is never nested inside the page's own <form>. */}
      {open &&
        createPortal(
          <Dialog open={open} onClose={() => setOpen(false)} title="Add a provider" size="sm">
            <form
              className="space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                event.stopPropagation(); // React events bubble through portals to the page form
                try {
                  const provider = await create({
                    ...form,
                    kind: form.kind as (typeof KINDS)[number],
                    profile: profileId,
                  }).unwrap();
                  onChange(provider.id);
                  toast.success(`${provider.name} added.`);
                  setOpen(false);
                  setForm({ name: "", kind: "DOCTOR", specialty: "", organization: "" });
                } catch (err) {
                  if (!Object.keys(getFieldErrors(err)).length) toast.error(err);
                }
              }}
            >
              <Field label="Name" required error={fieldErrors.name}>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Dr. Sharma"
                />
              </Field>
              <Field label="Type">
                <Select
                  value={form.kind}
                  onChange={(e) => setForm({ ...form, kind: e.target.value })}
                  options={toOptions(KINDS)}
                />
              </Field>
              <Field label="Specialty">
                <Input
                  value={form.specialty}
                  onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                  placeholder="Cardiology"
                />
              </Field>
              <Field label="Clinic / hospital">
                <Input
                  value={form.organization}
                  onChange={(e) => setForm({ ...form, organization: e.target.value })}
                />
              </Field>
              <FormActions>
                <Button variant="secondary" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={isLoading}>
                  Save provider
                </Button>
              </FormActions>
            </form>
          </Dialog>,
          document.body,
        )}
    </div>
  );
}
