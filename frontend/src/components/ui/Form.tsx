"use client";

import {
  cloneElement,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

import { cn } from "@/lib/cn";

const control =
  "block w-full rounded-lg border bg-white px-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 " +
  "focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 " +
  "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

const controlBorder = (invalid?: boolean) => (invalid ? "border-red-500" : "border-slate-300");

type FieldProps = {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  hideLabel?: boolean;
  children: ReactElement<{
    id?: string;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
    required?: boolean;
  }>;
};

/** Label + control + hint/error, wired together with ids for screen readers. */
export function Field({
  label,
  error,
  hint,
  required,
  className,
  hideLabel,
  children,
}: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const child = isValidElement(children)
    ? cloneElement(children, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
        required,
      })
    : children;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={id}
        className={cn("block text-sm font-medium text-slate-800", hideLabel && "sr-only")}
      >
        {label}
        {required && (
          <span className="text-red-600" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </label>
      {child}
      {hint && !error && (
        <p id={hintId} className="text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(control, "h-10", controlBorder(props["aria-invalid"] === true), className)}
      {...props}
    />
  );
}

export function Textarea({
  className,
  rows = 3,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={rows}
      className={cn(control, "py-2", controlBorder(props["aria-invalid"] === true), className)}
      {...props}
    />
  );
}

type Option = { value: string; label: string };

export function Select({
  options,
  placeholder,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { options: Option[]; placeholder?: string }) {
  return (
    <select
      className={cn(control, "h-10 pr-8", controlBorder(props["aria-invalid"] === true), className)}
      {...props}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function Checkbox({
  label,
  description,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }) {
  const id = useId();
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <input
        id={id}
        type="checkbox"
        className="text-brand-700 accent-brand-700 mt-0.5 size-4 shrink-0 rounded border-slate-300 focus-visible:outline-2"
        aria-describedby={description ? `${id}-desc` : undefined}
        {...props}
      />
      <div className="text-sm">
        <label htmlFor={id} className="font-medium text-slate-800">
          {label}
        </label>
        {description && (
          <p id={`${id}-desc`} className="text-slate-500">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

export function FormActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end", className)}>
      {children}
    </div>
  );
}

export const toOptions = (values: readonly string[], labels?: Record<string, string>): Option[] =>
  values.map((value) => ({
    value,
    label: labels?.[value] ?? value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " "),
  }));
