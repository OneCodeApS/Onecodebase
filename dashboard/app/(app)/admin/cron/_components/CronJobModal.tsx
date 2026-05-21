"use client";

import { useRef } from "react";
import { saveCronJob } from "../actions";

export function CronJobModal({
  trigger,
  initial,
  functions,
}: {
  trigger: React.ReactNode;
  initial?: {
    name: string;
    schedule: string;
    function_name: string;
    enabled: boolean;
  };
  functions: string[];
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const editing = !!initial;

  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) dialogRef.current?.close();
  }

  return (
    <>
      <span onClick={() => dialogRef.current?.showModal()}>{trigger}</span>

      <dialog
        ref={dialogRef}
        onClick={handleBackdropClick}
        className="m-auto w-full max-w-lg rounded-lg border border-neutral-700 bg-neutral-900 p-0 text-neutral-100 shadow-2xl shadow-black/50 backdrop:bg-black/60"
      >
        <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-3">
          <div className="text-lg font-semibold">
            {editing ? `Edit ${initial!.name}` : "New cron job"}
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close"
            className="rounded px-2 py-0.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
          >
            ✕
          </button>
        </div>

        <form action={saveCronJob} className="space-y-4 px-5 py-4">
          <div>
            <label
              htmlFor={`cron-name-${initial?.name ?? "new"}`}
              className="block text-xs uppercase tracking-wider text-neutral-500"
            >
              Name
            </label>
            <input
              id={`cron-name-${initial?.name ?? "new"}`}
              type="text"
              name="name"
              required
              autoFocus={!editing}
              readOnly={editing}
              defaultValue={initial?.name ?? ""}
              pattern="[a-z][a-z0-9_-]{0,62}"
              placeholder="hourly-cleanup"
              className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 font-mono text-sm read-only:opacity-70"
            />
          </div>

          <div>
            <label
              htmlFor={`cron-schedule-${initial?.name ?? "new"}`}
              className="block text-xs uppercase tracking-wider text-neutral-500"
            >
              Schedule
            </label>
            <input
              id={`cron-schedule-${initial?.name ?? "new"}`}
              type="text"
              name="schedule"
              required
              defaultValue={initial?.schedule ?? "0 * * * *"}
              placeholder="0 * * * *"
              className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 font-mono text-sm"
            />
            <p className="mt-1 text-xs text-neutral-500">
              5-field cron format. Examples:{" "}
              <span className="font-mono">0 * * * *</span> (every hour),{" "}
              <span className="font-mono">*/5 * * * *</span> (every 5 min),{" "}
              <span className="font-mono">0 0 * * *</span> (daily at midnight UTC).
            </p>
          </div>

          <div>
            <label
              htmlFor={`cron-fn-${initial?.name ?? "new"}`}
              className="block text-xs uppercase tracking-wider text-neutral-500"
            >
              Function to invoke
            </label>
            <select
              id={`cron-fn-${initial?.name ?? "new"}`}
              name="function_name"
              required
              defaultValue={initial?.function_name ?? ""}
              className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 font-mono text-sm"
            >
              <option value="" disabled>
                — pick one —
              </option>
              {functions.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-neutral-500">
              The function receives a POST with{" "}
              <span className="font-mono">X-Cron-Trigger: &lt;job-name&gt;</span>{" "}
              header.
            </p>
          </div>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={initial?.enabled ?? true}
              className="mt-1 h-4 w-4 accent-emerald-500"
            />
            <span>
              <span className="block text-sm font-medium text-neutral-200">
                Enabled
              </span>
              <span className="block text-xs text-neutral-500">
                Disable to pause without losing the schedule.
              </span>
            </span>
          </label>

          <div className="flex justify-end gap-2 border-t border-neutral-800 pt-4">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded border border-neutral-700 bg-neutral-800 px-4 py-1.5 text-sm hover:bg-neutral-700"
            >
              Save
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
