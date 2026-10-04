import type { Permission } from "@/types/api";

/** Human labels — mirror the backend's `Perm` choices. */
export const PERMISSION_LABELS: Record<Permission, string> = {
  VIEW_PROFILE: "View health profile",
  MANAGE_PROFILE: "Edit health profile",
  VIEW_MEDICATIONS: "View medications",
  MANAGE_MEDICATIONS: "Manage medications & log doses",
  VIEW_APPOINTMENTS: "View appointments",
  MANAGE_APPOINTMENTS: "Manage appointments",
  VIEW_DOCUMENTS: "View records & documents",
  UPLOAD_DOCUMENTS: "Add records & upload documents",
  VIEW_LAB_RESULTS: "View lab results",
  MANAGE_LAB_RESULTS: "Manage lab results",
  VIEW_TREATMENT_PLANS: "View treatment plans",
  MANAGE_TREATMENT_PLANS: "Manage treatment plans",
};

export type PermissionGroup = { area: string; view: Permission; manage: Permission };

/** Permissions grouped by area; each `manage` permission implies its `view` permission. */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  { area: "Health profile", view: "VIEW_PROFILE", manage: "MANAGE_PROFILE" },
  { area: "Medications", view: "VIEW_MEDICATIONS", manage: "MANAGE_MEDICATIONS" },
  { area: "Appointments", view: "VIEW_APPOINTMENTS", manage: "MANAGE_APPOINTMENTS" },
  { area: "Records & documents", view: "VIEW_DOCUMENTS", manage: "UPLOAD_DOCUMENTS" },
  { area: "Lab results", view: "VIEW_LAB_RESULTS", manage: "MANAGE_LAB_RESULTS" },
  { area: "Treatment plans", view: "VIEW_TREATMENT_PLANS", manage: "MANAGE_TREATMENT_PLANS" },
];

const IMPLIES = new Map<Permission, Permission>(PERMISSION_GROUPS.map((g) => [g.manage, g.view]));
const IMPLIED_BY = new Map<Permission, Permission>(
  PERMISSION_GROUPS.map((g) => [g.view, g.manage]),
);

const ORDER: Permission[] = PERMISSION_GROUPS.flatMap((g) => [g.view, g.manage]);

/**
 * Toggle one permission while keeping the set consistent: granting "manage"
 * also grants "view"; removing "view" also removes "manage".
 */
export function togglePermission(
  current: readonly Permission[],
  permission: Permission,
  checked: boolean,
): Permission[] {
  const next = new Set(current);
  if (checked) {
    next.add(permission);
    const implied = IMPLIES.get(permission);
    if (implied) next.add(implied);
  } else {
    next.delete(permission);
    const dependent = IMPLIED_BY.get(permission);
    if (dependent) next.delete(dependent);
  }
  return ORDER.filter((p) => next.has(p));
}

export function isPermission(value: string): value is Permission {
  return value in PERMISSION_LABELS;
}

/** Labels for display, collapsing "view" when the matching "manage" is present. */
export function describePermissions(permissions: readonly string[]): string[] {
  const set = new Set(permissions.filter(isPermission));
  return ORDER.filter(
    (p) => set.has(p) && !(IMPLIED_BY.has(p) && set.has(IMPLIED_BY.get(p) as Permission)),
  ).map((p) => PERMISSION_LABELS[p]);
}

export const RELATIONSHIPS = [
  "CHILD",
  "PARENT",
  "SPOUSE",
  "SIBLING",
  "GRANDPARENT",
  "OTHER",
] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];
