/** Where each backend resource type is shown in the UI (timeline, dashboard, notifications). */
export function resourceHref(resource: string, id: string): string {
  switch (resource) {
    case "appointment":
      return `/appointments/${id}`;
    case "medication":
      return `/medications/${id}`;
    case "record":
      return `/records/${id}`;
    case "document":
      return `/records/documents/${id}`;
    case "lab_report":
      return `/labs/${id}`;
    case "treatment_plan":
      return `/treatments/${id}`;
    case "vaccination":
    case "condition":
      return "/health-profile";
    default:
      return "/timeline";
  }
}
