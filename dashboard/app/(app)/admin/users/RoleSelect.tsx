"use client";

import { useRef } from "react";
import type { UserRole } from "@/lib/session";
import { setUserRole } from "./actions";

// Inline role editor for the users table. Submits on selection — no separate
// button. The server action redirects back to /admin/users, which re-renders
// the row with the saved role (or an error banner, e.g. last-admin guard).
// `editable` is false on the current user's own row: you can't change your own
// role (the server action enforces this too).
export function RoleSelect({
  id,
  role,
  editable = true,
}: {
  id: string;
  role: UserRole;
  editable?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={setUserRole} className="inline">
      <input type="hidden" name="id" value={id} />
      <select
        name="role"
        defaultValue={role}
        aria-label="Role"
        disabled={!editable}
        title={editable ? undefined : "You can't change your own role"}
        onChange={editable ? () => formRef.current?.requestSubmit() : undefined}
        className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="read_only">Read only</option>
        <option value="read_write">Read / write</option>
        <option value="admin">Admin</option>
      </select>
    </form>
  );
}
