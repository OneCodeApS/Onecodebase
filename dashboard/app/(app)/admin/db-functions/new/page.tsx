import Link from "next/link";
import { FunctionEditor } from "../_components/FunctionEditor";

const TEMPLATE = `CREATE OR REPLACE FUNCTION public.my_function()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- function body
  RAISE NOTICE 'hello';
END;
$$;
`;

export default async function NewDbFunctionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link
        href="/admin/db-functions"
        className="text-sm text-neutral-400 hover:text-neutral-100"
      >
        ← Back
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">New database function</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Paste or write a full{" "}
        <span className="font-mono">CREATE OR REPLACE FUNCTION</span> /{" "}
        <span className="font-mono">PROCEDURE</span> statement. Runs as{" "}
        <span className="font-mono">dashboard_admin</span>, so the new function
        will be owned by that role.
      </p>

      {sp.error && (
        <p className="mt-3 rounded border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {sp.error}
        </p>
      )}

      <div className="mt-6">
        <FunctionEditor oid="new" initialDefinition={TEMPLATE} />
      </div>
    </main>
  );
}
