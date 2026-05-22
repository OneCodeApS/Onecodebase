import { notFound } from "next/navigation";
import { Card } from "../../../../_components/Card";
import { pool } from "@/lib/db";
import { FUNCTION_NAME, getFunction } from "@/lib/functions";

type InvocationRow = {
  id: string;
  created_at: Date;
  success: boolean;
  ip: string | null;
  metadata: Record<string, unknown>;
};

async function loadInvocations(name: string, limit: number): Promise<InvocationRow[]> {
  const { rows } = await pool().query<InvocationRow>(
    `SELECT id, created_at, success, host(ip) AS ip, metadata
       FROM _dashboard.audit_log
      WHERE action = 'function.invoke' AND target = $1
      ORDER BY id DESC
      LIMIT $2`,
    [name, limit],
  );
  return rows;
}

function formatTime(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().replace("T", " ").slice(0, 19);
}

export default async function InvocationsPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name: raw } = await params;
  const name = decodeURIComponent(raw);
  if (!FUNCTION_NAME.test(name)) notFound();
  const fn = await getFunction(name);
  if (!fn) notFound();

  const invocations = await loadInvocations(name, 100);

  return (
    <Card className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-700 bg-neutral-800/60 text-left text-neutral-400">
            <th className="px-3 py-2 font-normal">When</th>
            <th className="px-3 py-2 font-normal">Method</th>
            <th className="px-3 py-2 font-normal text-right">Status</th>
            <th className="px-3 py-2 font-normal text-right">Duration</th>
            <th className="px-3 py-2 font-normal">IP</th>
            <th className="px-3 py-2 font-normal">Error</th>
          </tr>
        </thead>
        <tbody>
          {invocations.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center text-neutral-500">
                No invocations yet.
              </td>
            </tr>
          ) : (
            invocations.map((i) => {
              const meta = i.metadata ?? {};
              const status = meta.status as number | undefined;
              const duration = meta.duration_ms as number | undefined;
              const method = meta.method as string | undefined;
              const error = (meta.error as string | undefined) ?? null;
              return (
                <tr
                  key={i.id}
                  className="border-b border-neutral-800 last:border-b-0 odd:bg-neutral-900 even:bg-neutral-950/40"
                >
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-neutral-400">
                    {formatTime(i.created_at)}
                  </td>
                  <td className="px-3 py-2 font-mono text-neutral-300">
                    {method ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {i.success ? (
                      <span className="text-emerald-400">{status ?? "OK"}</span>
                    ) : (
                      <span className="text-red-400">500</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-neutral-400">
                    {duration !== undefined ? `${duration}ms` : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-neutral-500">
                    {i.ip ?? "—"}
                  </td>
                  <td
                    className="max-w-md truncate px-3 py-2 font-mono text-xs text-red-400"
                    title={error ?? ""}
                  >
                    {error ?? ""}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </Card>
  );
}
