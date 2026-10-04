"use client";

import { Pencil, Plus, Trash2, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button, ConfirmDialog, EmptyState, ErrorState, LoadingState } from "@/components/ui";
import { useToast } from "@/hooks/useToast";

import {
  RecordFormDialog,
  emptyValues,
  valuesFromItem,
  type FieldDef,
  type FormValues,
} from "./RecordForm";

export type RecordItem = { id: string };

export type ItemSummary = {
  title: ReactNode;
  /** Plain-text name used in confirmations and aria-labels. */
  name: string;
  details?: ReactNode;
  meta?: ReactNode;
};

/**
 * A list of profile-scoped health entries with add / edit / delete-with-confirm.
 * Manage controls are hidden when `canManage` is false (the API enforces it too).
 */
export function RecordListSection<T extends RecordItem>({
  noun,
  items,
  isLoading,
  error,
  refetch,
  canManage,
  fields,
  defaults,
  summarize,
  onCreate,
  onUpdate,
  onDelete,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  header,
  validate,
  transform,
}: {
  /** Singular, lowercase noun, e.g. "allergy". */
  noun: string;
  items: T[] | undefined;
  isLoading: boolean;
  error: unknown;
  refetch: () => unknown;
  canManage: boolean;
  fields: FieldDef[];
  defaults?: FormValues;
  summarize: (item: T) => ItemSummary;
  onCreate: (body: Record<string, unknown>) => Promise<unknown>;
  onUpdate: (id: string, body: Record<string, unknown>) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  emptyIcon?: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
  header?: ReactNode;
  validate?: (values: FormValues) => Record<string, string>;
  transform?: (values: FormValues, changed: string) => FormValues;
}) {
  const [editing, setEditing] = useState<T | "new" | null>(null);
  const [deleting, setDeleting] = useState<T | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const toast = useToast();
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);

  const addButton = canManage ? (
    <Button
      size="sm"
      onClick={() => setEditing("new")}
      icon={<Plus className="size-4" aria-hidden />}
    >
      Add {noun}
    </Button>
  ) : null;

  let content: ReactNode;
  if (isLoading) content = <LoadingState />;
  else if (error) content = <ErrorState error={error} onRetry={refetch} />;
  else if (!items?.length)
    content = (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        action={addButton}
      />
    );
  else
    content = (
      <>
        {header}
        {addButton && <div className="mb-3 flex justify-end">{addButton}</div>}
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {items.map((item) => {
            const summary = summarize(item);
            return (
              <li
                key={item.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                    {summary.title}
                  </div>
                  {summary.details && (
                    <div className="text-sm text-slate-600">{summary.details}</div>
                  )}
                  {summary.meta && <div className="text-xs text-slate-500">{summary.meta}</div>}
                </div>
                {canManage && (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(item)}
                      aria-label={`Edit ${summary.name}`}
                      icon={<Pencil className="size-4" aria-hidden />}
                    >
                      <span className="sm:sr-only">Edit</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-700 hover:bg-red-50"
                      onClick={() => setDeleting(item)}
                      aria-label={`Delete ${summary.name}`}
                      icon={<Trash2 className="size-4" aria-hidden />}
                    >
                      <span className="sm:sr-only">Delete</span>
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </>
    );

  const isNew = editing === "new";
  return (
    <div>
      {content}
      <RecordFormDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={isNew ? `Add ${noun}` : `Edit ${noun}`}
        fields={fields}
        initialValues={
          editing && editing !== "new"
            ? valuesFromItem(fields, editing as unknown as Record<string, unknown>)
            : emptyValues(fields, defaults)
        }
        submitLabel={isNew ? `Add ${noun}` : "Save changes"}
        validate={validate}
        transform={transform}
        onSubmit={async (body) => {
          if (editing === "new") await onCreate(body);
          else if (editing) await onUpdate(editing.id, body);
          toast.success(isNew ? `${Noun} added.` : `${Noun} updated.`);
          setEditing(null);
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={`Delete ${noun}?`}
        message={
          <>
            <strong className="text-slate-900">{deleting ? summarize(deleting).name : ""}</strong>{" "}
            will be removed permanently. This can&apos;t be undone.
          </>
        }
        confirmLabel="Delete"
        loading={deleteBusy}
        onConfirm={async () => {
          if (!deleting) return;
          setDeleteBusy(true);
          try {
            await onDelete(deleting.id);
            toast.success(`${Noun} deleted.`);
            setDeleting(null);
          } catch (err) {
            toast.error(err);
          } finally {
            setDeleteBusy(false);
          }
        }}
      />
    </div>
  );
}
