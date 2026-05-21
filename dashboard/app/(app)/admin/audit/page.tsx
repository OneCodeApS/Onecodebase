import { pool } from "@/lib/db";
import { Card } from "../../_components/Card";
import { AuditFilters, type AuditFilterValues } from "./_components/AuditFilters";
import { AuditPagination } from "./_components/AuditPagination";
import { VerifyButton } from "./_components/VerifyButton";

const PAGE_SIZE = 50;

type Row = {
  id: string;
  created_at: Date;
  actor: string;
  role: string | null;
  action: string;
  target: string | null;
  statement: string | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  success: boolean;
  session_id: string | null;
  prev_hash: string | null;
  hash: string | null;
};

type SearchParams = {
  actor?: string;
  action?: string;
  success?: string;
  from?: string;
  to?: string;
  page?: string;
};

function parseFilters(sp: SearchParams): AuditFilterValues {
  return {
    actor: sp.actor?.trim() ?? "",
    action: sp.action?.trim() ?? "",
    success: sp.success === "true" || sp.success === "false" ? sp.success : "",
    from: sp.from ?? "",
    to: sp.to ?? "",
  };
}

// Builds a parameterised WHERE clause from the filters. All user input is
// passed as positional parameters — never interpolated into the SQL string.
function buildWhere(filters: AuditFilterValues): {
  where: string;
  params: unknown[];
} {
  const conds: string[] = [];
  const params: unknown[] = [];

  if (filters.actor) {
    params.push(`%${filters.actor.toLowerCase()}%`);
    conds.push(`lower(actor) LIKE $${params.length}`);
  }
  if (filters.action) {
    params.push(`%${filters.action}%`);
    conds.push(`action LIKE $${params.length}`);
  }
  if (filters.success === "true") conds.push("success = true");
  if (filters.success === "false") conds.push("success = false");
  if (filters.from) {
    params.push(filters.from);
    conds.push(`created_at >= $${params.length}`);
  }
  if (filters.to) {
    // Include the entire `to` day.
    params.push(`${filters.to} 23:59:59`);
    conds.push(`created_at <= $${params.length}`);
  }

  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  return { where, params };
}

async function loadCount(where: string, params: unknown[]): Promise<number> {
  const { rows } = await pool().query<{ n: string }>(
    `SELECT count(*)::text AS n FROM _dashboard.audit_log ${where}`,
    params,
  );
  return Number(rows[0]?.n ?? 0);
}

async function loadRows(
  where: string,
  params: unknown[],
  limit: number,
  offset: number,
): Promise<Row[]> {
  const { rows } = await pool().query<Row>(
    `SELECT id, created_at, actor, role, action, target, statement,
            metadata, host(ip) AS ip, success, session_id, prev_hash, hash
       FROM _dashboard.audit_log
       ${where}
       ORDER BY id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );
  return rows;
}

function formatTime(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().replace("T", " ").slice(0, 19);
}

function truncate(s: string | null, n = 60): string {
  if (!s) return "";
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const { where, params } = buildWhere(filters);

  const [total, rows] = await Promise.all([
    loadCount(where, params),
    loadRows(where, params, PAGE_SIZE, offset),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + rows.length, total);

  return (
    <main className="px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Audit log</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Every meaningful action is recorded here with a SHA-256 hash chain.{" "}
            {total.toLocaleString()} {total === 1 ? "entry" : "entries"} match the current filters.
          </p>
        </div>
        <VerifyButton />
      </div>

      <Card padded className="mt-6">
        <AuditFilters values={filters} />
      </Card>

      <Card className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-700 bg-neutral-800/60 text-left text-neutral-400">
              <th className="px-3 py-2 font-normal">When</th>
              <th className="px-3 py-2 font-normal">Actor</th>
              <th className="px-3 py-2 font-normal">Role</th>
              <th className="px-3 py-2 font-normal">Action</th>
              <th className="px-3 py-2 font-normal">Target</th>
              <th className="px-3 py-2 font-normal">Statement</th>
              <th className="px-3 py-2 font-normal text-center">OK?</th>
              <th className="px-3 py-2 font-normal">IP</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-neutral-500">
                  No entries.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const statement = truncate(r.statement, 80);
                const target = truncate(r.target, 40);
                return (
                  <tr
                    key={r.id}
                    className="border-b border-neutral-800 last:border-b-0 odd:bg-neutral-900 even:bg-neutral-950/40 hover:bg-neutral-800/50"
                  >
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-neutral-400">
                      {formatTime(r.created_at)}
                    </td>
                    <td className="px-3 py-2 font-mono text-neutral-200">{r.actor}</td>
                    <td className="px-3 py-2 text-neutral-400">{r.role ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-neutral-200">{r.action}</td>
                    <td
                      className="max-w-xs truncate px-3 py-2 font-mono text-neutral-300"
                      title={r.target ?? ""}
                    >
                      {target || "—"}
                    </td>
                    <td
                      className="max-w-md truncate px-3 py-2 font-mono text-neutral-300"
                      title={r.statement ?? ""}
                    >
                      {statement || "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {r.success ? (
                        <span className="text-emerald-400">✓</span>
                      ) : (
                        <span className="text-red-400">✗</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-neutral-500">
                      {r.ip ?? "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>

      <AuditPagination
        page={page}
        totalPages={totalPages}
        from={from}
        to={to}
        total={total}
        filters={filters}
      />
    </main>
  );
}
