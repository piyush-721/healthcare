import { Button } from "./Button";

export function Pagination({
  page,
  count,
  pageSize = 20,
  onChange,
}: {
  page: number;
  count: number;
  pageSize?: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  if (pages <= 1) return null;
  return (
    <nav
      className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm"
      aria-label="Pagination"
    >
      <p className="text-slate-600">
        Page {page} of {pages} · {count} total
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
