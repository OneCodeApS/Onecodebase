import { getSession } from "@/lib/session";
import { SqlEditor } from "./_components/SqlEditor";

export default async function SqlPage() {
  const session = await getSession();
  const role = session.role ?? "read_only";

  return (
    <main className="px-6 py-10">
      <h1 className="text-2xl font-semibold">SQL Editor</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Run ad-hoc queries against the database. Every statement is recorded in the audit log.
      </p>

      <div className="mt-6">
        <SqlEditor role={role} />
      </div>
    </main>
  );
}
