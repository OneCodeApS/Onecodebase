"use client";

import { deleteEndUser } from "../actions";

// Confirms before submitting — auth.users CASCADEs to identities + sessions,
// so this really wipes the account.
export function DeleteUserButton({ id, email }: { id: string; email: string }) {
  function confirmDelete(e: React.FormEvent<HTMLFormElement>) {
    if (
      !window.confirm(
        `Permanently delete ${email}? This removes their identities and sessions and cannot be undone.`,
      )
    ) {
      e.preventDefault();
    }
  }
  return (
    <form action={deleteEndUser} className="inline" onSubmit={confirmDelete}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="text-xs text-red-400 underline hover:text-red-200"
      >
        Delete
      </button>
    </form>
  );
}
