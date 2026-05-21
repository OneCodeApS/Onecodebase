"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

export type TableEntry = {
  table_name: string;
  approx_rows: number;
};

export function TablesSidebar({ tables }: { tables: TableEntry[] }) {
  const pathname = usePathname();
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    if (!filter) return tables;
    const q = filter.toLowerCase();
    return tables.filter((t) => t.table_name.toLowerCase().includes(q));
  }, [tables, filter]);

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-neutral-800 bg-neutral-950">
      <div className="border-b border-neutral-800 px-3 py-3">
        <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">
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
        {filtered.length === 0 ? (
          <p className="px-2 py-2 text-xs text-neutral-500">
            {tables.length === 0 ? "No tables." : "No matches."}
          </p>
        ) : (
          filtered.map((t) => {
            const href = `/tables/${encodeURIComponent(t.table_name)}`;
            const isActive = pathname === href;
            return (
              <Link
                key={t.table_name}
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
