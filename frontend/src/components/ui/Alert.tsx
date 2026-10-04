import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type Tone = "info" | "success" | "warning" | "error";

const styles: Record<Tone, { box: string; icon: ReactNode }> = {
  info: {
    box: "border-sky-200 bg-sky-50 text-sky-900",
    icon: <Info className="size-5 text-sky-700" aria-hidden />,
  },
  success: {
    box: "border-emerald-200 bg-emerald-50 text-emerald-900",
    icon: <CheckCircle2 className="size-5 text-emerald-700" aria-hidden />,
  },
  warning: {
    box: "border-amber-200 bg-amber-50 text-amber-900",
    icon: <AlertTriangle className="size-5 text-amber-700" aria-hidden />,
  },
  error: {
    box: "border-red-200 bg-red-50 text-red-900",
    icon: <XCircle className="size-5 text-red-700" aria-hidden />,
  },
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
  action,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-lg border p-3 text-sm", styles[tone].box, className)}
    >
      <div className="shrink-0">{styles[tone].icon}</div>
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
