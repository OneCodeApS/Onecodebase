import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "../../../_components/Card";
import { ConfirmDeleteForm } from "../../../_components/ConfirmDeleteForm";
import { getDbFunctionByOid } from "@/lib/db-introspect";
import { deleteDbFunction } from "../actions";
import { FunctionEditor } from "../_components/FunctionEditor";
import { getSession } from "@/lib/session";

const SYSTEM_SCHEMAS = new Set(["_dashboard", "auth"]);

export default async function DbFunctionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ oid: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { oid } = await params;
  const sp = await searchParams;
  const fn = await getDbFunctionByOid(oid);
  if (!fn) notFound();
  const session = await getSession();
  const isAdmin = session.role === "admin";
  if (session.role === "read_only" && SYSTEM_SCHEMAS.has(fn.schema)) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link
        href={`/admin/db-functions?schema=${encodeURIComponent(fn.schema)}`}
        className="text-sm text-neutral-400 hover:text-neutral-100"
      >
        ← Back to {fn.schema}
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl font-semibold">
            {fn.schema}.{fn.name}
          </h1>
          <p
            className="mt-1 truncate font-mono text-sm text-neutral-400"
            title={fn.args || "(no arguments)"}
          >
            ({fn.args || ""}) → {fn.returns}
          </p>
        </div>
        {isAdmin && (
          <ConfirmDeleteForm
            action={deleteDbFunction}
            triggerLabel="Delete"
            triggerClassName="rounded border border-red-900/50 px-3 py-1.5 text-sm text-red-300 hover:bg-red-950/40"
            title="Delete function?"
            message={
              <>
                Permanently drop{" "}
                <span className="font-mono text-neutral-100">
                  {fn.schema}.{fn.name}({fn.args || ""})
                </span>
                ? Anything depending on it will fail unless dropped too.
              </>
            }
          >
            <input type="hidden" name="oid" value={fn.oid} />
          </ConfirmDeleteForm>
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

      <Card padded className="mt-6">
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs uppercase tracking-wider text-neutral-500">
              Language
            </dt>
            <dd className="font-mono text-neutral-200">{fn.language}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-neutral-500">
              Volatility
            </dt>
            <dd className="font-mono text-neutral-200">{fn.volatility}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-neutral-500">
              Security
            </dt>
            <dd className="font-mono text-neutral-200">
              {fn.security_definer ? (
                <span className="text-amber-400">DEFINER</span>
              ) : (
                "INVOKER"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-neutral-500">
              Owner
            </dt>
            <dd className="font-mono text-neutral-200">{fn.owner}</dd>
          </div>
        </dl>
      </Card>

      <div className="mt-6">
        <h2 className="text-sm font-medium text-neutral-300">Definition</h2>
        {isAdmin && (
          <p className="mt-1 text-xs text-neutral-500">
            Edit the full <span className="font-mono">CREATE OR REPLACE</span>{" "}
            statement. Changing the signature creates a new overload rather than
            replacing the existing one — delete the old version separately if you
            want to remove it.
          </p>
        )}
        <div className="mt-3">
          <FunctionEditor
            oid={fn.oid}
            initialDefinition={fn.definition}
            readOnly={!isAdmin}
          />
        </div>
      </div>
    </main>
  );
}
