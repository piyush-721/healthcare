import { Info } from "lucide-react";

/** Reminder shown wherever clinical values are displayed. */
export function MedicalDisclaimer({ children }: { children?: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-xs text-slate-500">
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>
        {children ??
          "HealthOS organizes your information and does not interpret it. Discuss results and treatment decisions with your healthcare provider."}
      </span>
    </p>
  );
}
