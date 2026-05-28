import Link from "next/link";
import { Card } from "../../_components/Card";
import { listFunctions } from "@/lib/functions";
import { NewFunctionModal } from "./_components/NewFunctionModal";
import { getSession } from "@/lib/session";

export default async function FunctionsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const sp = await searchParams;
  const functions = await listFunctions();
  const session = await getSession();
  const isAdmin = session.role === "admin";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Edge functions</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Server-side JavaScript invoked via{" "}
            <span className="font-mono">/functions/v1/&lt;name&gt;</span>.
          </p>
        </div>
        {isAdmin && <NewFunctionModal />}
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
              <th className="px-3 py-2 font-normal">Description</th>
              <th className="px-3 py-2 font-normal text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {functions.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-neutral-500">
                  No functions yet. Click <strong>+ New function</strong> to get started.
                </td>
              </tr>
            ) : (
              functions.map((f) => (
                <tr
                  key={f.name}
                  className="border-b border-neutral-800 last:border-b-0 odd:bg-neutral-900 even:bg-neutral-950/40 hover:bg-neutral-800/50"
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/functions/${encodeURIComponent(f.name)}/overview`}
                      className="font-mono text-neutral-100 hover:underline"
                    >
                      {f.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-neutral-400">
                    {f.description ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {f.enabled ? (
                      <span className="rounded border border-emerald-900/50 bg-emerald-950/30 px-2 py-0.5 text-xs text-emerald-300">
                        enabled
                      </span>
                    ) : (
                      <span className="rounded border border-neutral-700 bg-neutral-800/40 px-2 py-0.5 text-xs text-neutral-400">
                        disabled
                      </span>
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
