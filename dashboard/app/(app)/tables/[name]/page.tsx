import Link from "next/link";
import { notFound } from "next/navigation";
import { pool } from "@/lib/db";
import { Card } from "../../_components/Card";

const PAGE_SIZE = 50;

// Identifiers in Postgres can be letters/digits/underscore (and dollar sign,
// but we don't allow those). Validating here is belt-and-suspenders — we also
// confirm the table exists in information_schema before interpolating its name
// into the data query.
const SAFE_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

type Column = {
  column_name: string;
  data_type: string;
};

async function loadColumns(table: string): Promise<Column[]> {
  const { rows } = await pool().query<Column>(
    `SELECT column_name, data_type
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position`,
    [table],
  );
  return rows;
}

async function loadRowCount(table: string): Promise<number> {
  // Exact count is expensive on large tables; this view's "Page X of Y" needs
  // it though. If perf becomes an issue, switch to reltuples and label it ~.
  const { rows } = await pool().query<{ n: string }>(
    `SELECT count(*)::text AS n FROM public."${table}"`,
  );
  return Number(rows[0]?.n ?? 0);
}

async function loadRows(
  table: string,
  limit: number,
  offset: number,
): Promise<Record<string, unknown>[]> {
  const { rows } = await pool().query<Record<string, unknown>>(
    // ORDER BY 1 gives a stable-ish order by the first column. Good enough
    // for browsing; not authoritative without a real key.
    `SELECT * FROM public."${table}" ORDER BY 1 LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return rows;
}

function renderCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export default async function TableRowsPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { name: rawName } = await params;
  const sp = await searchParams;
  const name = decodeURIComponent(rawName);

  if (!SAFE_IDENT.test(name)) notFound();
  const columns = await loadColumns(name);
  if (columns.length === 0) notFound();

  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const [total, rows] = await Promise.all([
    loadRowCount(name),
    loadRows(name, PAGE_SIZE, offset),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + rows.length, total);

  return (
    <main className="px-6 py-10">
      <h1 className="text-2xl font-semibold">
        <span className="font-mono">public.{name}</span>
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        {total.toLocaleString()} {total === 1 ? "row" : "rows"} ·{" "}
        {columns.length} {columns.length === 1 ? "column" : "columns"}
      </p>

      <Card className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-700 bg-neutral-800/60 text-left text-neutral-400">
              {columns.map((c) => (
                <th key={c.column_name} className="px-3 py-2 font-normal">
                  <div className="font-mono text-neutral-100">{c.column_name}</div>
                  <div className="text-xs text-neutral-500">{c.data_type}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-neutral-500">
                  No rows.
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-neutral-800 last:border-b-0 odd:bg-neutral-900 even:bg-neutral-950/40 hover:bg-neutral-800/50"
                >
                  {columns.map((c) => {
                    const text = renderCell(row[c.column_name]);
                    return (
                      <td
                        key={c.column_name}
                        className="max-w-xs truncate px-3 py-2 font-mono text-neutral-300"
                        title={text}
                      >
                        {text}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <nav className="mt-4 flex items-center justify-between text-sm text-neutral-400">
        <span>
          {from}–{to} of {total.toLocaleString()}
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              href={`/tables/${encodeURIComponent(name)}?page=${page - 1}`}
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
              href={`/tables/${encodeURIComponent(name)}?page=${page + 1}`}
              className="rounded border border-neutral-700 px-2 py-1 hover:bg-neutral-800"
            >
              Next →
            </Link>
          )}
        </div>
      </nav>
    </main>
  );
}
