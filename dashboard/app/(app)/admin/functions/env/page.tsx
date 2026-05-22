import { Card } from "../../../_components/Card";
import { listEnvVars } from "@/lib/function-env";
import { removeEnvVar } from "./actions";
import { EnvVarModal } from "./_components/EnvVarModal";

function formatTime(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().replace("T", " ").slice(0, 19);
}

export default async function EnvPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const vars = await listEnvVars();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Environment variables</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Global vars available to every edge function as{" "}
            <span className="font-mono">ctx.env.&lt;KEY&gt;</span>.
          </p>
        </div>
        <EnvVarModal
          trigger={
            <button
              type="button"
              className="rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
            >
              + New variable
            </button>
          }
        />
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
              <th className="px-3 py-2 font-normal">Key</th>
              <th className="px-3 py-2 font-normal">Value</th>
              <th className="px-3 py-2 font-normal">Description</th>
              <th className="px-3 py-2 font-normal">Updated</th>
              <th className="px-3 py-2 font-normal" />
            </tr>
          </thead>
          <tbody>
            {vars.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-neutral-500">
                  No variables yet. Click <strong>+ New variable</strong>.
                </td>
              </tr>
            ) : (
              vars.map((v) => (
                <tr
                  key={v.key}
                  className="border-b border-neutral-800 last:border-b-0 odd:bg-neutral-900 even:bg-neutral-950/40 hover:bg-neutral-800/50"
                >
                  <td className="px-3 py-2 font-mono text-neutral-200">{v.key}</td>
                  <td className="px-3 py-2 font-mono text-neutral-400">
                    {v.value === "" ? (
                      <span className="text-neutral-600">(empty)</span>
                    ) : (
                      <span className="text-neutral-300">{v.preview}</span>
                    )}
                    {v.legacy_plaintext && (
                      <span
                        className="ml-2 rounded border border-amber-900/40 bg-amber-950/30 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-amber-400"
                        title="Stored in the legacy plaintext column. Re-save (Edit → Save) to encrypt."
                      >
                        unencrypted
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-neutral-400">
                    {v.description ?? "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-neutral-500">
                    {formatTime(v.updated_at)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-3">
                      <EnvVarModal
                        trigger={
                          <button
                            type="button"
                            className="text-xs text-neutral-400 underline hover:text-neutral-100"
                          >
                            Edit
                          </button>
                        }
                        initial={{
                          key: v.key,
                          value: v.value,
                          description: v.description,
                        }}
                      />
                      <form action={removeEnvVar} className="inline">
                        <input type="hidden" name="key" value={v.key} />
                        <button
                          type="submit"
                          className="text-xs text-red-400 underline hover:text-red-200"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
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
