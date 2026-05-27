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
// setUserRole dropdown below). The CLI (npm run create-admin) remains the
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

// Change an existing operator's role. Admin-gated like the rest. Guards against
// demoting the last admin, which would leave no one able to reach the admin UI.
export async function setUserRole(formData: FormData) {
  const session = await requireAdmin();
  const ip = await clientIp();
  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "") as AssignableRole;
  if (!id) redirect("/admin/users");
  if (!ASSIGNABLE_ROLES.includes(role)) {
    redirect("/admin/users?error=" + encodeURIComponent("Invalid role"));
  }
  // You can't change your own role — prevents self-lockout and forces a second
  // admin to make the call.
  if (id === session.userId) {
    redirect("/admin/users?error=" + encodeURIComponent("You can't change your own role."));
  }

  const cur = await pool().query<{ email: string; role: AssignableRole }>(
    "SELECT email, role FROM _dashboard.users WHERE id = $1",
    [id],
  );
  if (cur.rows.length === 0) {
    redirect("/admin/users?error=" + encodeURIComponent("User not found"));
  }
  const { email, role: currentRole } = cur.rows[0];

  if (currentRole === role) {
    redirect("/admin/users?ok=" + encodeURIComponent(`${email} is already ${role}`));
  }

  // Demoting the last admin would lock everyone out of the admin-only pages.
  if (currentRole === "admin" && role !== "admin") {
    const { rows } = await pool().query<{ n: number }>(
      "SELECT count(*)::int AS n FROM _dashboard.users WHERE role = 'admin'",
    );
    if (rows[0].n <= 1) {
      redirect(
        "/admin/users?error=" +
          encodeURIComponent("Can't change the last admin's role — promote another admin first."),
      );
    }
  }

  await pool().query(
    "UPDATE _dashboard.users SET role = $2, updated_at = now() WHERE id = $1",
    [id, role],
  );

  await audit({
    actor: session.email!,
    actorId: session.userId!,
    role: "admin",
    action: "user.role_change",
    target: email,
    success: true,
    ip,
    sessionId: session.sessionId ?? null,
    metadata: { from: currentRole, to: role },
  });

  redirect("/admin/users?ok=" + encodeURIComponent(`${email}: ${currentRole} → ${role}`));
}
