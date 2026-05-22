"use client";

import { ConfirmDeleteForm } from "../../../_components/ConfirmDeleteForm";
import { deleteEndUser } from "../actions";

// Permanently deletes an end user. auth.users CASCADEs to identities + sessions,
// so this really wipes the account.
export function DeleteUserButton({ id, email }: { id: string; email: string }) {
  return (
    <ConfirmDeleteForm
      action={deleteEndUser}
      triggerLabel="Delete"
      triggerClassName="text-xs text-red-400 underline hover:text-red-200"
      title="Delete user?"
      message={
        <>
          Permanently delete <span className="font-mono text-neutral-100">{email}</span>?
          This removes their identities and sessions and cannot be undone.
        </>
      }
    >
      <input type="hidden" name="id" value={id} />
    </ConfirmDeleteForm>
  );
}
