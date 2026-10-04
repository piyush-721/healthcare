"use client";

import { FileQuestion, Lock, RefreshCw, SearchX, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { errorStatus, getErrorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/cn";

import { Button } from "./Button";
import { Spinner } from "./Spinner";

export function EmptyState({
  icon: Icon = FileQuestion,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-10 text-center", className)}>
      <div className="bg-brand-50 text-brand-700 mb-3 rounded-full p-3">
        <Icon className="size-6" aria-hidden />
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingState({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-3 py-12 text-sm text-slate-500",
        className,
      )}
      role="status"
    >
      <Spinner className="text-brand-700" />
      <span>{label}</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-slate-200/70", className)} aria-hidden />;
}

/** Error display that distinguishes unauthorized, not-found and generic failures. */
export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const status = errorStatus(error);
  if (status === 403) {
    return (
      <EmptyState
        icon={Lock}
        className={className}
        title="You don't have access to this"
        description={getErrorMessage(
          error,
          "Ask the profile owner to grant you the needed permission.",
        )}
      />
    );
  }
  if (status === 404) {
    return (
      <EmptyState
        icon={SearchX}
        className={className}
        title="Not found"
        description="This item doesn't exist or is no longer shared with you."
      />
    );
  }
  return (
    <div
      className={cn("flex flex-col items-center px-6 py-10 text-center", className)}
      role="alert"
    >
      <h3 className="text-base font-semibold text-slate-900">Something went wrong</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{getErrorMessage(error)}</p>
      {onRetry && (
        <Button
          variant="secondary"
          className="mt-4"
          onClick={onRetry}
          icon={<RefreshCw className="size-4" aria-hidden />}
        >
          Try again
        </Button>
      )}
    </div>
  );
}

type QueryLike<T> = {
  data?: T;
  error?: unknown;
  isLoading: boolean;
  isFetching?: boolean;
  refetch?: () => unknown;
};

/**
 * Renders loading / error / empty / success for an RTK Query result so every
 * screen handles all states consistently.
 */
export function QueryState<T>({
  query,
  isEmpty,
  empty,
  loading,
  children,
}: {
  query: QueryLike<T>;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  loading?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (query.isLoading) return <>{loading ?? <LoadingState />}</>;
  if (query.error)
    return (
      <ErrorState
        error={query.error}
        onRetry={query.refetch ? () => query.refetch?.() : undefined}
      />
    );
  if (query.data === undefined) return <>{loading ?? <LoadingState />}</>;
  if (isEmpty?.(query.data) && empty) return <>{empty}</>;
  return <>{children(query.data)}</>;
}
