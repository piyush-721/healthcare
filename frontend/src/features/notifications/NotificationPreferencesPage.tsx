"use client";

import { useState } from "react";

import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  FormActions,
  PageHeader,
  QueryState,
} from "@/components/ui";
import { useToast } from "@/hooks/useToast";
import {
  useNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
} from "@/services/notifications";
import type { NotificationPreference } from "@/types/api";

function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 has-[:disabled]:cursor-not-allowed">
      <input
        type="checkbox"
        role="switch"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden
        className="peer-checked:bg-brand-700 peer-focus-visible:outline-brand-600 relative h-6 w-10 rounded-full bg-slate-300 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-disabled:opacity-60 after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-4"
      />
      <span className="w-7 text-xs text-slate-600" aria-hidden>
        {checked ? "On" : "Off"}
      </span>
    </label>
  );
}

function PreferencesForm({ initial }: { initial: NotificationPreference[] }) {
  const [prefs, setPrefs] = useState(initial);
  const [save, { isLoading }] = useUpdateNotificationPreferencesMutation();
  const toast = useToast();
  const dirty = JSON.stringify(prefs) !== JSON.stringify(initial);

  const set = (category: string, key: "email_enabled" | "in_app_enabled", value: boolean) =>
    setPrefs((prev) => prev.map((p) => (p.category === category ? { ...p, [key]: value } : p)));

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        try {
          await save(
            prefs.map((p) => ({
              category: p.category,
              email_enabled: p.email_enabled,
              in_app_enabled: p.in_app_enabled,
            })),
          ).unwrap();
          toast.success("Notification preferences saved.");
        } catch (err) {
          toast.error(err);
        }
      }}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <caption className="sr-only">Notification preferences by category</caption>
          <thead className="border-b border-slate-200 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">
            <tr>
              <th scope="col" className="py-2 pr-4">
                Category
              </th>
              <th scope="col" className="px-2 py-2">
                Email
              </th>
              <th scope="col" className="px-2 py-2">
                In-app
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {prefs.map((p) => (
              <tr key={p.category}>
                <th scope="row" className="py-3 pr-4 text-left font-medium text-slate-900">
                  {p.label}
                  {p.in_app_locked && (
                    <span className="block text-xs font-normal text-slate-500">
                      In-app alerts are always on for your safety.
                    </span>
                  )}
                </th>
                <td className="px-2 py-3">
                  <Toggle
                    label={`${p.label}: email`}
                    checked={p.email_enabled}
                    disabled={isLoading}
                    onChange={(v) => set(p.category, "email_enabled", v)}
                  />
                </td>
                <td className="px-2 py-3">
                  <Toggle
                    label={`${p.label}: in-app`}
                    checked={p.in_app_enabled}
                    disabled={isLoading || p.in_app_locked}
                    onChange={(v) => set(p.category, "in_app_enabled", v)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <FormActions className="mt-4">
        <Button
          variant="secondary"
          disabled={!dirty || isLoading}
          onClick={() => setPrefs(initial)}
        >
          Reset
        </Button>
        <Button type="submit" loading={isLoading} disabled={!dirty}>
          Save preferences
        </Button>
      </FormActions>
    </form>
  );
}

export function NotificationPreferencesPage() {
  const query = useNotificationPreferencesQuery();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Notification preferences"
        description="Choose how HealthOS keeps you informed."
        back={{ href: "/settings", label: "Settings" }}
      />
      <Card className="max-w-3xl">
        <CardHeader
          title="Delivery channels"
          description="Turn email and in-app notifications on or off per category."
        />
        <CardBody>
          <QueryState
            query={query}
            isEmpty={(d) => d.length === 0}
            empty={<Alert>No notification categories available.</Alert>}
          >
            {(prefs) => <PreferencesForm key={JSON.stringify(prefs)} initial={prefs} />}
          </QueryState>
        </CardBody>
      </Card>
    </div>
  );
}
