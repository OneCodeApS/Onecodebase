import Link from "next/link";
import type { AuditFilterValues } from "./AuditFilters";

// Build a pagination URL that preserves the active filters in the query string.
function pageHref(page: number, filters: AuditFilterValues): string {
  const params = new URLSearchParams();
  if (filters.actor) params.set("actor", filters.actor);
  if (filters.action) params.set("action", filters.action);
  if (filters.success) params.set("success", filters.success);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `?${qs}` : "?";
}

export function AuditPagination({
  page,
  totalPages,
  from,
  to,
  total,
  filters,
}: {
  page: number;
  totalPages: number;
  from: number;
  to: number;
  total: number;
  filters: AuditFilterValues;
}) {
  return (
    <nav className="mt-4 flex items-center justify-between text-sm text-neutral-400">
      <span>
        {from}–{to} of {total.toLocaleString()}
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <Link
            href={pageHref(page - 1, filters)}
            className="rounded border border-neutral-700 px-2 py-1 hover:bg-neutral-800"
          >
            ← Prev
          </Link>
        )}
        <span className="px-2 py-1 text-neutral-500">
          Page {page} of {totalPages}
        </span>
        {page < totalPages && (
          <Link
            href={pageHref(page + 1, filters)}
            className="rounded border border-neutral-700 px-2 py-1 hover:bg-neutral-800"
          >
            Next →
          </Link>
        )}
      </div>
    </nav>
  );
}
