export type AuditFilterValues = {
  actor: string;
  action: string;
  success: "" | "true" | "false";
  from: string;
  to: string;
};

// Plain GET form — submits to the same page with the filters as query params,
// no JS needed. Server component re-renders with the filtered data.
export function AuditFilters({ values }: { values: AuditFilterValues }) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      <Field label="Actor">
        <input
          type="text"
          name="actor"
          defaultValue={values.actor}
          placeholder="email contains…"
          className="w-48 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm"
        />
      </Field>
      <Field label="Action">
        <input
          type="text"
          name="action"
          defaultValue={values.action}
          placeholder="e.g. login, sql, user."
          className="w-48 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm"
        />
      </Field>
      <Field label="Result">
        <select
          name="success"
          defaultValue={values.success}
          className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm"
        >
          <option value="">All</option>
          <option value="true">Success</option>
          <option value="false">Failed</option>
        </select>
      </Field>
      <Field label="From">
        <input
          type="date"
          name="from"
          defaultValue={values.from}
          className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm"
        />
      </Field>
      <Field label="To">
        <input
          type="date"
          name="to"
          defaultValue={values.to}
          className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm"
        />
      </Field>
      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded border border-neutral-700 bg-neutral-800 px-3 py-1 text-sm hover:bg-neutral-700"
        >
          Apply
        </button>
        <a
          href="?"
          className="rounded border border-neutral-700 px-3 py-1 text-sm hover:bg-neutral-800"
        >
          Clear
        </a>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wider text-neutral-500">{label}</span>
      {children}
    </label>
  );
}
