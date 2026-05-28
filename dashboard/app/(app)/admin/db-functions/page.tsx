import Link from "next/link";
import { Card } from "../../_components/Card";
import { ConfirmDeleteForm } from "../../_components/ConfirmDeleteForm";
import {
  countExtensionFunctions,
  listDbFunctions,
  listUserSchemas,
} from "@/lib/db-introspect";
import { deleteDbFunction } from "./actions";
import { getSession } from "@/lib/session";

const SYSTEM_SCHEMAS = new Set(["_dashboard", "auth"]);

export default async function DbFunctionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    schema?: string;
    ext?: string;
    ok?: string;
    error?: string;
  }>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  const isAdmin = session.role === "admin";
  const canViewSystemSchemas = session.role !== "read_only";
  const allSchemas = await listUserSchemas();
  const schemas = canViewSystemSchemas
    ? allSchemas
    : allSchemas.filter((s) => !SYSTEM_SCHEMAS.has(s));
  const selectedSchema =
    sp.schema && schemas.includes(sp.schema)
      ? sp.schema
      : schemas.includes("public")
        ? "public"
        : (schemas[0] ?? "public");

  const includeExtensions = sp.ext === "1";
  const [fns, extensionCount] = await Promise.all([
    listDbFunctions(selectedSchema, includeExtensions),
    countExtensionFunctions(selectedSchema),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Database functions</h1>
          <p className="mt-1 text-sm text-neutral-500">
            User-defined SQL / PLpgSQL functions and procedures. Not to be
            confused with{" "}
            <Link href="/admin/functions" className="underline hover:text-neutral-300">
              edge functions
            </Link>
            , which run JavaScript in the dashboard process.
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/admin/db-functions/new"
            className="rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
          >
            + New function
          </Link>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-neutral-500">
            Schema
          </span>
          <div className="flex flex-wrap gap-1.5">
            {schemas.map((s) => {
              const params = new URLSearchParams();
              params.set("schema", s);
              if (includeExtensions) params.set("ext", "1");
              return (
                <Link
                  key={s}
                  href={`/admin/db-functions?${params.toString()}`}
                  className={`rounded px-2 py-0.5 text-xs ${
                    s === selectedSchema
                      ? "bg-neutral-700 text-neutral-100"
                      : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
                  }`}
                >
                  {s}
                </Link>
              );
            })}
          </div>
        </div>

        {extensionCount > 0 && (
          <Link
            href={
              includeExtensions
                ? `/admin/db-functions?schema=${encodeURIComponent(selectedSchema)}`
                : `/admin/db-functions?schema=${encodeURIComponent(selectedSchema)}&ext=1`
            }
            className="rounded border border-neutral-700 px-2 py-0.5 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
            title="Functions installed by extensions (pgcrypto, etc.) are hidden by default"
          >
            {includeExtensions
              ? `Hide ${extensionCount} extension function${extensionCount === 1 ? "" : "s"}`
              : `Show ${extensionCount} extension function${extensionCount === 1 ? "" : "s"}`}
          </Link>
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
              <th className="px-3 py-2 font-normal">Args</th>
              <th className="px-3 py-2 font-normal">Returns</th>
              <th className="px-3 py-2 font-normal">Lang</th>
              <th className="px-3 py-2 font-normal">Volatility</th>
              <th className="px-3 py-2 font-normal">Security</th>
              <th className="px-3 py-2 font-normal">Owner</th>
              <th className="px-3 py-2 font-normal" />
            </tr>
          </thead>
          <tbody>
            {fns.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-neutral-500">
                  No functions in{" "}
                  <span className="font-mono">{selectedSchema}</span>.
                </td>
              </tr>
            ) : (
              fns.map((f) => (
                <tr
                  key={f.oid}
                  className="border-b border-neutral-800 last:border-b-0 odd:bg-neutral-900 even:bg-neutral-950/40"
                >
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-neutral-200">
                    <Link
                      href={`/admin/db-functions/${f.oid}`}
                      className="underline hover:text-neutral-100"
                    >
                      {f.name}
                    </Link>
                    {f.kind !== "function" && (
                      <span
                        className="ml-2 rounded border border-neutral-700 bg-neutral-800/40 px-1.5 py-0.5 text-[10px] uppercase text-neutral-400"
                        title={`Postgres ${f.kind}`}
                      >
                        {f.kind}
                      </span>
                    )}
                  </td>
                  <td
                    className="max-w-[24ch] truncate px-3 py-2 font-mono text-xs text-neutral-400"
                    title={f.args || "(none)"}
                  >
                    {f.args || "—"}
                  </td>
                  <td
                    className="max-w-[20ch] truncate px-3 py-2 font-mono text-xs text-neutral-400"
                    title={f.returns}
                  >
                    {f.returns}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-neutral-400">
                    {f.language}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-neutral-400">
                    {f.volatility}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">
                    {f.security_definer ? (
                      <span
                        className="text-amber-400"
                        title="Runs with the privileges of the function owner — be careful with what's inside"
                      >
                        DEFINER
                      </span>
                    ) : (
                      <span className="text-neutral-500">INVOKER</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-neutral-500">
                    {f.owner}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-3">
                      <Link
                        href={`/admin/db-functions/${f.oid}`}
                        className="text-xs text-neutral-400 underline hover:text-neutral-100"
                      >
                        Open
                      </Link>
                      {isAdmin && (
                        <ConfirmDeleteForm
                          action={deleteDbFunction}
                          triggerLabel="Delete"
                          triggerClassName="text-xs text-red-400 underline hover:text-red-200"
                          title="Delete function?"
                          message={
                            <>
                              Permanently drop{" "}
                              <span className="font-mono text-neutral-100">
                                {f.schema}.{f.name}({f.args || ""})
                              </span>
                              ? Anything depending on it (views, other functions,
                              policies referencing it) will fail unless dropped
                              too.
                            </>
                          }
                        >
                          <input type="hidden" name="oid" value={f.oid} />
                        </ConfirmDeleteForm>
                      )}
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
