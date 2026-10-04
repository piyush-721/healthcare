"use client";

import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useEffect } from "react";

import { cn } from "@/lib/cn";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { toastDismissed, type Toast } from "@/store/slices/toastSlice";

function ToastItem({ toast }: { toast: Toast }) {
  const dispatch = useAppDispatch();
  useEffect(() => {
    const timer = setTimeout(
      () => dispatch(toastDismissed(toast.id)),
      toast.tone === "error" ? 8000 : 4500,
    );
    return () => clearTimeout(timer);
  }, [dispatch, toast]);
  const Icon = toast.tone === "success" ? CheckCircle2 : toast.tone === "error" ? XCircle : Info;
  return (
    <div
      className={cn(
        "pointer-events-auto flex w-full items-start gap-3 rounded-lg border bg-white p-3 text-sm shadow-lg",
        toast.tone === "error" ? "border-red-200" : "border-slate-200",
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-5 shrink-0",
          toast.tone === "success" && "text-emerald-600",
          toast.tone === "error" && "text-red-600",
          toast.tone === "info" && "text-sky-600",
        )}
        aria-hidden
      />
      <p className="flex-1 text-slate-800">{toast.message}</p>
      <button
        type="button"
        onClick={() => dispatch(toastDismissed(toast.id))}
        className="rounded text-slate-400 hover:text-slate-600"
        aria-label="Dismiss notification"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useAppSelector((state) => state.toasts);
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-4 bottom-20 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
