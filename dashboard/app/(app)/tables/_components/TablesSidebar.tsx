"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

export type TableEntry = {
  schema: string;
  table_name: string;
  approx_rows: number;
};

const DEFAULT_SCHEMA = "public";

export function TablesSidebar({ tables }: { tables: TableEntry[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filter, setFilter] = useState("");

  // Available schemas come from whichever schemas have tables (no point
  // listing an empty schema in the picker). Sorted with `public` first.
  const schemas = useMemo(() => {
    const set = new Set(tables.map((t) => t.schema));
    const arr = Array.from(set);
    arr.sort((a, b) => {
      if (a === DEFAULT_SCHEMA) return -1;
      if (b === DEFAULT_SCHEMA) return 1;
      return a.localeCompare(b);
    });
    return arr;
  }, [tables]);

  const activeSchema = searchParams.get("schema") ?? DEFAULT_SCHEMA;

  const filteredTables = useMemo(() => {
    let result = tables.filter((t) => t.schema === activeSchema);
    if (filter) {
      const q = filter.toLowerCase();
      result = result.filter((t) => t.table_name.toLowerCase().includes(q));
    }
    return result;
  }, [tables, activeSchema, filter]);

  function pickSchema(s: string) {
    const params = new URLSearchParams(searchParams);
    if (s === DEFAULT_SCHEMA) params.delete("schema");
    else params.set("schema", s);
    // Always send the user to the /tables index when switching schemas —
    // the currently-open table doesn't necessarily exist in the new schema.
    const qs = params.toString();
    router.push(qs ? `/tables?${qs}` : "/tables");
  }

  function tableHref(t: TableEntry): string {
    const params = new URLSearchParams();
    if (t.schema !== DEFAULT_SCHEMA) params.set("schema", t.schema);
    const qs = params.toString();
    return qs
      ? `/tables/${encodeURIComponent(t.table_name)}?${qs}`
      : `/tables/${encodeURIComponent(t.table_name)}`;
  }

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-neutral-800 bg-neutral-950">
      <div className="border-b border-neutral-800 px-3 py-3">
        <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">
          Schema
        </div>
        <select
          value={activeSchema}
          onChange={(e) => pickSchema(e.target.value)}
          className="mt-2 w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 font-mono text-xs text-neutral-200 focus:border-neutral-500 focus:outline-none"
        >
          {schemas.length === 0 ? (
            <option value={DEFAULT_SCHEMA}>{DEFAULT_SCHEMA}</option>
          ) : (
            schemas.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))
          )}
        </select>

        <div className="mt-3 text-xs font-medium uppercase tracking-wider text-neutral-500">
          Tables
        </div>
        <input
          type="search"
          placeholder="Filter…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="mt-2 w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200 placeholder-neutral-500 focus:border-neutral-500 focus:outline-none"
        />
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {filteredTables.length === 0 ? (
          <p className="px-2 py-2 text-xs text-neutral-500">
            {filter ? "No matches." : "No tables in this schema."}
          </p>
        ) : (
          filteredTables.map((t) => {
            const href = tableHref(t);
            // Active state: pathname matches AND schema query matches.
            const pathnameMatches =
              pathname === `/tables/${encodeURIComponent(t.table_name)}`;
            const schemaMatches =
              (searchParams.get("schema") ?? DEFAULT_SCHEMA) === t.schema;
            const isActive = pathnameMatches && schemaMatches;
            return (
              <Link
                key={`${t.schema}.${t.table_name}`}
                href={href}
                className={`flex items-center justify-between rounded px-2 py-1.5 text-sm ${
                  isActive
                    ? "bg-neutral-800 text-neutral-100"
                    : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
                }`}
              >
                <span className="truncate font-mono">{t.table_name}</span>
                <span className="ml-2 shrink-0 text-xs text-neutral-500">
                  {t.approx_rows < 0 ? "" : t.approx_rows.toLocaleString()}
                </span>
              </Link>
            );
          })
        )}
      </nav>
    </aside>
  );
}
