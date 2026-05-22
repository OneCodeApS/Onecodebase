import Link from "next/link";
import { getSetting } from "@/lib/settings";
import { Card } from "../../_components/Card";
import { runAuditPruneNow, updateAuditRetention, updateAuditSubdir } from "./actions";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const sp = await searchParams;
  const subdir = (await getSetting<string>("audit_subdir")) ?? "default";
  const retentionDays = (await getSetting<number>("audit_retention_days")) ?? 30;
  const root = process.env.AUDIT_LOG_DIR ?? "/audit";

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mt-4 text-2xl font-semibold">Audit settings</h1>

      {sp.error && (
        <p className="mt-3 rounded border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {sp.error}
        </p>
      )}
      {sp.ok && (
        <p className="mt-3 rounded border border-emerald-900/50 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-300">
          {sp.ok}
        </p>
      )}

      <Card padded className="mt-6">
        <h2 className="text-lg font-medium">Log destination</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Audit log files are written to{" "}
          <span className="font-mono text-neutral-300">{root}/&lt;subdir&gt;/audit-YYYY-MM-DD.jsonl</span>
          {" "}inside the dashboard container. The container path{" "}
          <span className="font-mono text-neutral-300">{root}</span> is mounted from the host;
          the subdirectory below is what you can change here.
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Allowed: letters, digits, <code>.</code> <code>_</code> <code>-</code>. Other characters are replaced with <code>_</code>.
        </p>

        <form action={updateAuditSubdir} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            name="subdir"
            required
            defaultValue={subdir}
            className="flex-1 rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 font-mono text-sm"
          />
          <button
            type="submit"
            className="rounded border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800"
          >
            Save
          </button>
        </form>
      </Card>

      <Card padded className="mt-6">
        <h2 className="text-lg font-medium">Database retention</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Audit-log rows older than this are pruned daily from the database.
          The on-disk JSONL files (above) are <strong>not</strong> deleted —
          they remain the long-term archive. Set to <span className="font-mono">0</span> to keep all rows forever.
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          The hash chain stays verifiable on the retained window: the prune
          routine stores the last-deleted row&apos;s hash as a chain anchor.
        </p>

        <form action={updateAuditRetention} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="number"
            name="days"
            required
            min={0}
            step={1}
            defaultValue={retentionDays}
            className="w-32 rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 font-mono text-sm"
          />
          <span className="self-center text-sm text-neutral-400">days</span>
          <div className="flex-1" />
          <button
            type="submit"
            className="rounded border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800"
          >
            Save
          </button>
        </form>

        <form action={runAuditPruneNow} className="mt-3">
          <button
            type="submit"
            className="rounded border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
          >
            Run prune now
          </button>
          <span className="ml-3 text-xs text-neutral-500">
            Runs the prune routine immediately against the current retention setting.
          </span>
        </form>
      </Card>
    </main>
  );
}
