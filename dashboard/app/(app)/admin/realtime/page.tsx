import { Card } from "../../_components/Card";
import { listRealtimeStatus } from "@/lib/realtime";
import { toggleRealtime } from "./actions";

export default async function RealtimePage() {
  const tables = await listRealtimeStatus();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Realtime</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Enable per-table row-change streams. When on, every INSERT, UPDATE,
        and DELETE is broadcast on{" "}
        <span className="font-mono">/realtime?schema=&lt;s&gt;&amp;table=&lt;t&gt;</span>
        {" "}as Server-Sent Events. Subscribers need a valid access token from{" "}
        <span className="font-mono">/auth/v1</span>.
      </p>

      <Card className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-700 bg-neutral-800/60 text-left text-neutral-400">
              <th className="px-3 py-2 font-normal">Schema</th>
              <th className="px-3 py-2 font-normal">Table</th>
              <th className="px-3 py-2 font-normal text-right">Realtime</th>
            </tr>
          </thead>
          <tbody>
            {tables.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-neutral-500">
                  No tables.
                </td>
              </tr>
            ) : (
              tables.map((t) => (
                <tr
                  key={`${t.schema}.${t.table}`}
                  className="border-b border-neutral-800 last:border-b-0 odd:bg-neutral-900 even:bg-neutral-950/40 hover:bg-neutral-800/50"
                >
                  <td className="px-3 py-2 font-mono text-neutral-400">
                    {t.schema}
                  </td>
                  <td className="px-3 py-2 font-mono text-neutral-200">
                    {t.table}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <form action={toggleRealtime} className="inline">
                      <input type="hidden" name="schema" value={t.schema} />
                      <input type="hidden" name="table" value={t.table} />
                      <input
                        type="hidden"
                        name="enable"
                        value={t.enabled ? "false" : "true"}
                      />
                      <button
                        type="submit"
                        className={`rounded border px-3 py-0.5 text-xs ${
                          t.enabled
                            ? "border-emerald-900/50 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-950/50"
                            : "border-neutral-700 bg-neutral-800/40 text-neutral-300 hover:bg-neutral-800"
                        }`}
                      >
                        {t.enabled ? "ON · click to disable" : "OFF · click to enable"}
                      </button>
                    </form>
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
