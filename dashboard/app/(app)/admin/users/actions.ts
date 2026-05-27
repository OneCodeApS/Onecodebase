"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { hashPassword } from "@/lib/auth";
import { pool } from "@/lib/db";
import { audit } from "@/lib/audit";

async function clientIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip");
}

async function requireAdmin() {
  const s = await getSession();
  if (s.role !== "admin") {
    redirect("/");
  }
  return s;
}

// Roles the admin UI is allowed to assign. 'admin' is included so an existing
// admin can grant admin to other operators (via the create form or the
// promoteToAdmin action below). The CLI (npm run create-admin) remains the
// bootstrap path for the very first admin. Every entry point here is behind
// requireAdmin(), so only admins can hand out admin.
const ASSIGNABLE_ROLES = ["admin", "read_write", "read_only"] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export async function createUser(formData: FormData) {
  const session = await requireAdmin();
  const ip = await clientIp();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "") as AssignableRole;

  if (!email.includes("@") || password.length < 12) {
    redirect("/admin/users?error=" + encodeURIComponent("Invalid email or password too short"));
  }
  if (!ASSIGNABLE_ROLES.includes(role)) {
    redirect("/admin/users?error=" + encodeURIComponent("Invalid role"));
  }

  const password_hash = await hashPassword(password);
  let newId: string | null = null;
  let errMsg: string | null = null;
  try {
    const r = await pool().query<{ id: string }>(
      `INSERT INTO _dashboard.users (email, password_hash, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [email, password_hash, role],
    );
    if (r.rows.length === 0) {
      errMsg = "Email already in use";
    } else {
      newId = r.rows[0].id;
    }
  } catch (e) {
    errMsg = (e as Error).message;
  }

  await audit({
    actor: session.email!,
    actorId: session.userId!,
    role: "admin",
    action: "user.create",
    target: email,
    success: !errMsg,
    ip,
    sessionId: session.sessionId ?? null,
    metadata: { role, new_user_id: newId },
  });

  if (errMsg) {
    redirect("/admin/users?error=" + encodeURIComponent(errMsg));
  }
  redirect("/admin/users?ok=" + encodeURIComponent(`Created ${email} (${role})`));
}

async function setDisabledAt(id: string, disabled: boolean, session: Awaited<ReturnType<typeof getSession>>) {
  const ip = await clientIp();
  // Guard: admins can only be disabled via direct DB intervention, not the UI.
  const r = await pool().query<{ email: string; role: string }>(
    `UPDATE _dashboard.users
        SET disabled_at = ${disabled ? "now()" : "NULL"},
            updated_at  = now()
      WHERE id = $1 AND role <> 'admin'
      RETURNING email, role`,
    [id],
  );
  const target = r.rows[0]?.email ?? id;
  await audit({
    actor: session.email!,
    actorId: session.userId!,
    role: "admin",
    action: disabled ? "user.disable" : "user.enable",
    target,
    success: r.rowCount === 1,
    ip,
    sessionId: session.sessionId ?? null,
  });
}

export async function disableUser(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (id) await setDisabledAt(id, true, session);
  redirect("/admin/users");
}

export async function enableUser(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (id) await setDisabledAt(id, false, session);
  redirect("/admin/users");
}

// Promote an existing operator to admin. Admin-gated like the rest. The
// `role <> 'admin'` guard makes this a no-op (rowCount 0) if the target is
// already an admin or the id is unknown; the audit row records either outcome.
export async function promoteToAdmin(formData: FormData) {
  const session = await requireAdmin();
  const ip = await clientIp();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/admin/users");

  const r = await pool().query<{ email: string }>(
    `UPDATE _dashboard.users
        SET role = 'admin',
            updated_at = now()
      WHERE id = $1 AND role <> 'admin'
      RETURNING email`,
    [id],
  );
  const target = r.rows[0]?.email ?? id;
  await audit({
    actor: session.email!,
    actorId: session.userId!,
    role: "admin",
    action: "user.promote",
    target,
    success: r.rowCount === 1,
    ip,
    sessionId: session.sessionId ?? null,
    metadata: { role: "admin" },
  });

  redirect(
    r.rowCount === 1
      ? "/admin/users?ok=" + encodeURIComponent(`${target} is now an admin`)
      : "/admin/users",
  );
}
