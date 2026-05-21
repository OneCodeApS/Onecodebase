import Link from "next/link";
import { getSession } from "@/lib/session";
import { logout } from "./logout/actions";

export default async function Home() {
  const session = await getSession();
  const isAdmin = session.role === "admin";
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold">Signed in</h1>
      <p className="mt-2 text-neutral-400">
        as <span className="font-mono text-neutral-100">{session.email}</span>{" "}
        <span className="ml-2 rounded border border-neutral-700 px-1.5 py-0.5 text-xs text-neutral-400">
          {session.role}
        </span>
      </p>

      {isAdmin && (
        <nav className="mt-8 flex gap-3 text-sm">
          <Link
            href="/admin/users"
            className="rounded border border-neutral-700 px-3 py-1.5 hover:bg-neutral-800"
          >
            Manage users
          </Link>
          <Link
            href="/admin/settings"
            className="rounded border border-neutral-700 px-3 py-1.5 hover:bg-neutral-800"
          >
            Audit settings
          </Link>
        </nav>
      )}

      <p className="mt-8 text-sm text-neutral-500">
        Dashboard features will land here. Milestone 1 just proves auth + routing
        + the reverse proxy work end-to-end.
      </p>

      <form action={logout} className="mt-8">
        <button
          type="submit"
          className="rounded border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
