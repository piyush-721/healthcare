"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";

import { cn } from "@/lib/cn";

export type TabItem = { id: string; label: ReactNode; count?: number };

/** WAI-ARIA tabs with arrow-key navigation. Render the active panel via `children`. */
export function Tabs({
  items,
  value,
  onChange,
  children,
  label,
}: {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  children?: ReactNode;
  label: string;
}) {
  const baseId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % items.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else return;
    event.preventDefault();
    refs.current[next]?.focus();
    onChange(items[next].id);
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label={label}
        className="-mb-px flex gap-1 overflow-x-auto border-b border-slate-200"
      >
        {items.map((item, index) => {
          const selected = item.id === value;
          return (
            <button
              key={item.id}
              ref={(el) => {
                refs.current[index] = el;
              }}
              role="tab"
              type="button"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(item.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                "flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                selected
                  ? "border-brand-700 text-brand-800"
                  : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900",
              )}
            >
              {item.label}
              {item.count !== undefined && (
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {children !== undefined && (
        <div
          role="tabpanel"
          id={`${baseId}-panel`}
          aria-labelledby={`${baseId}-tab-${value}`}
          className="pt-4"
        >
          {children}
        </div>
      )}
    </div>
  );
}
