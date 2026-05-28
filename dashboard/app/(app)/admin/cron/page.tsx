import { Card } from "../../_components/Card";
import { ConfirmDeleteForm } from "../../_components/ConfirmDeleteForm";
import { listCronJobs } from "@/lib/cron";
import { listFunctions } from "@/lib/functions";
import { removeCronJob } from "./actions";
import { CronJobModal } from "./_components/CronJobModal";
import { getSession } from "@/lib/session";

function formatTime(d: Date | string | null): string {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().replace("T", " ").slice(0, 19);
}

export default async function CronPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const [jobs, functions] = await Promise.all([listCronJobs(), listFunctions()]);
  const functionNames = functions.map((f) => f.name);
  const session = await getSession();
  const isAdmin = session.role === "admin";

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Cron jobs</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Scheduled invocations of edge functions. The scheduler runs
            in-process — only one dashboard instance fires each job.
          </p>
        </div>
        {isAdmin && (
          <CronJobModal
            functions={functionNames}
            trigger={
              <button
                type="button"
                className="rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
              >
                + New cron job
              </button>
            }
          />
        )}
      </div>

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

      <Card className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-700 bg-neutral-800/60 text-left text-neutral-400">
              <th className="px-3 py-2 font-normal">Name</th>
              <th className="px-3 py-2 font-normal">Schedule</th>
              <th className="px-3 py-2 font-normal">Function</th>
              <th className="px-3 py-2 font-normal">Status</th>
              <th className="px-3 py-2 font-normal">Last run</th>
              <th className="px-3 py-2 font-normal" />
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-neutral-500">
                  No cron jobs yet. {functionNames.length === 0
                    ? "Create a function first."
                    : <>Click <strong>+ New cron job</strong> to add one.</>}
                </td>
              </tr>
            ) : (
              jobs.map((j) => (
                <tr
                  key={j.name}
                  className="border-b border-neutral-800 last:border-b-0 odd:bg-neutral-900 even:bg-neutral-950/40 hover:bg-neutral-800/50"
                >
                  <td className="px-3 py-2 font-mono text-neutral-200">
                    {j.name}
                    {!j.enabled && (
                      <span className="ml-2 rounded border border-neutral-700 bg-neutral-800/40 px-1.5 py-0.5 text-[10px] uppercase text-neutral-400">
                        disabled
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-neutral-400">
                    {j.schedule}
                  </td>
                  <td className="px-3 py-2 font-mono text-neutral-300">
                    {j.function_name}
                  </td>
                  <td className="px-3 py-2">
                    {j.last_status === "success" && (
                      <span className="text-emerald-400">
                        ✓ {j.last_duration_ms ?? "?"}ms
                      </span>
                    )}
                    {j.last_status === "failed" && (
                      <span
                        className="text-red-400"
                        title={j.last_error ?? ""}
                      >
                        ✗ {j.last_error?.slice(0, 40) ?? "failed"}
                      </span>
                    )}
                    {j.last_status === "running" && (
                      <span className="text-amber-400">running…</span>
                    )}
                    {!j.last_status && (
                      <span className="text-neutral-500">never run</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-neutral-500">
                    {formatTime(j.last_run_at)}
                  </td>
                  <td className="px-3 py-2">
                    {isAdmin && (
                    <div className="flex justify-end gap-3">
                      <CronJobModal
                        functions={functionNames}
                        trigger={
                          <button
                            type="button"
                            className="text-xs text-neutral-400 underline hover:text-neutral-100"
                          >
                            Edit
                          </button>
                        }
                        initial={{
                          name: j.name,
                          schedule: j.schedule,
                          function_name: j.function_name,
                          enabled: j.enabled,
                        }}
                      />
                      <ConfirmDeleteForm
                        action={removeCronJob}
                        triggerLabel="Delete"
                        triggerClassName="text-xs text-red-400 underline hover:text-red-200"
                        title="Delete cron job?"
                        message={
                          <>
                            Delete cron job{" "}
                            <span className="font-mono text-neutral-100">{j.name}</span>?
                            The schedule stops immediately. The function itself is not affected.
                          </>
                        }
                      >
                        <input type="hidden" name="name" value={j.name} />
                      </ConfirmDeleteForm>
                    </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </main>
  );
}
