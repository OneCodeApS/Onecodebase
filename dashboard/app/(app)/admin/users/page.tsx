import Link from "next/link";
import { pool } from "@/lib/db";
import type { UserRole } from "@/lib/session";
import { Card } from "../../_components/Card";
import { createUser, disableUser, enableUser } from "./actions";

type Row = {
  id: string;
  email: string;
  role: UserRole;
  created_at: Date;
  disabled_at: Date | null;
};

async function loadUsers(): Promise<Row[]> {
  const { rows } = await pool().query<Row>(
    `SELECT id, email, role, created_at, disabled_at
       FROM _dashboard.users
       ORDER BY role, email`,
  );
  return rows;
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const sp = await searchParams;
  const users = await loadUsers();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mt-4 text-2xl font-semibold">Users</h1>

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
        <h2 className="text-lg font-medium">Create user</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Read-only users can view data only. Read/write users can also modify it.
          Neither can manage other users — admins are bootstrapped via the CLI.
        </p>
        <form action={createUser} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            name="email"
            required
            placeholder="customer@example.com"
            className="flex-1 rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm"
          />
          <input
            type="password"
            name="password"
            required
            minLength={12}
            placeholder="Initial password (min 12 chars)"
            className="flex-1 rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm"
          />
          <select
            name="role"
            required
            defaultValue="read_only"
            className="rounded border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm"
          >
            <option value="read_only">Read only</option>
            <option value="read_write">Read / write</option>
          </select>
          <button
            type="submit"
            className="rounded border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800"
          >
            Create
          </button>
        </form>
      </Card>

      <Card className="mt-6 overflow-x-auto">
        <h2 className="px-5 pt-4 text-lg font-medium">All users</h2>
        <table className="mt-3 w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-neutral-700 bg-neutral-800/60 text-left text-neutral-400">
              <th className="px-5 py-2 font-normal">Email</th>
              <th className="py-2 pr-3 font-normal">Role</th>
              <th className="py-2 pr-3 font-normal">Status</th>
              <th className="py-2 pr-3 font-normal">Created</th>
              <th className="py-2 pr-5 font-normal" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                className="border-b border-neutral-800 last:border-b-0 odd:bg-neutral-900 even:bg-neutral-950/40 hover:bg-neutral-800/50"
              >
                <td className="px-5 py-2 font-mono">{u.email}</td>
                <td className="py-2 pr-3">{u.role}</td>
                <td className="py-2 pr-3">
                  {u.disabled_at ? (
                    <span className="text-amber-400">disabled</span>
                  ) : (
                    <span className="text-emerald-400">active</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-neutral-500">
                  {new Date(u.created_at).toISOString().slice(0, 10)}
                </td>
                <td className="py-2 pr-5">
                  {u.role !== "admin" && (
                    <form
                      action={u.disabled_at ? enableUser : disableUser}
                      className="inline"
                    >
                      <input type="hidden" name="id" value={u.id} />
                      <button
                        type="submit"
                        className="text-xs text-neutral-400 underline hover:text-neutral-100"
                      >
                        {u.disabled_at ? "Enable" : "Disable"}
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </main>
  );
}
