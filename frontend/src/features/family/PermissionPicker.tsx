"use client";

import { Checkbox } from "@/components/ui";
import type { Permission } from "@/types/api";

import { PERMISSION_GROUPS, PERMISSION_LABELS, togglePermission } from "./permissions";

/**
 * Granular permission checkboxes grouped by area. Granting "manage" also
 * grants "view" (the view box is then locked on), mirroring the backend rule.
 */
export function PermissionPicker({
  value,
  onChange,
  error,
  disabled,
}: {
  value: Permission[];
  onChange: (next: Permission[]) => void;
  error?: string;
  disabled?: boolean;
}) {
  const selected = new Set(value);
  return (
    <fieldset
      aria-describedby={error ? "permission-error" : "permission-hint"}
      className="space-y-2"
    >
      <legend className="text-sm font-medium text-slate-800">
        Permissions
        <span className="text-red-600" aria-hidden="true">
          {" "}
          *
        </span>
      </legend>
      <p id="permission-hint" className="text-xs text-slate-500">
        Choose exactly what they can see or do. “Manage” access always includes “View”.
      </p>
      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {PERMISSION_GROUPS.map((group) => {
          const manageChecked = selected.has(group.manage);
          return (
            <div
              key={group.area}
              role="group"
              aria-label={group.area}
              className="grid gap-2 px-3 py-2.5 sm:grid-cols-[10rem_1fr_1fr] sm:items-start"
            >
              <p className="text-sm font-medium text-slate-900">{group.area}</p>
              <Checkbox
                label={PERMISSION_LABELS[group.view]}
                description={manageChecked ? "Included with manage access" : undefined}
                checked={selected.has(group.view) || manageChecked}
                disabled={disabled || manageChecked}
                onChange={(e) => onChange(togglePermission(value, group.view, e.target.checked))}
              />
              <Checkbox
                label={PERMISSION_LABELS[group.manage]}
                checked={manageChecked}
                disabled={disabled}
                onChange={(e) => onChange(togglePermission(value, group.manage, e.target.checked))}
              />
            </div>
          );
        })}
      </div>
      {error && (
        <p id="permission-error" role="alert" className="text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </fieldset>
  );
}
