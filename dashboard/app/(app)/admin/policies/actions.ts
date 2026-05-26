"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { pool } from "@/lib/db";
import { quoteIdent, SAFE_IDENT } from "@/lib/db-introspect";
import { audit } from "@/lib/audit";
import { getSession } from "@/lib/session";

async function requireAdmin() {
  const s = await getSession();
  if (s.role !== "admin") throw new Error("Admin only");
  return s;
}

async function clientIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip");
}

const VALID_CMDS = new Set(["ALL", "SELECT", "INSERT", "UPDATE", "DELETE"]);
const VALID_PERMISSIVE = new Set(["PERMISSIVE", "RESTRICTIVE"]);

function parseRoles(raw: string): string[] {
  // Comma-separated, trim, drop empties, dedupe. "public" is a valid role
  // and means "anyone connected to the DB". If the list is empty, default
  // to {public} (which is also what CREATE POLICY does when TO is omitted).
  const out = Array.from(
    new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  );
  return out.length === 0 ? ["public"] : out;
}

function validateRoles(roles: string[]): void {
  for (const r of roles) {
    // `public` is a special pseudo-role keyword; not subject to the ident regex.
    if (r === "public") continue;
    if (!SAFE_IDENT.test(r)) {
      throw new Error(`Invalid role name: ${r}`);
    }
  }
}

function emptyToNull(s: string): string | null {
  const t = s.trim();
  return t === "" ? null : t;
}

function rolesClause(roles: string[]): string {
  return roles
    .map((r) => (r === "public" ? "public" : quoteIdent(r)))
    .join(", ");
}

function redirectBack(error?: string, ok?: string): never {
  const params = new URLSearchParams();
  if (error) params.set("error", error);
  if (ok) params.set("ok", ok);
  const qs = params.toString();
  redirect(`/admin/policies${qs ? "?" + qs : ""}`);
}

export async function createPolicy(formData: FormData) {
  const session = await requireAdmin();
  const ip = await clientIp();

  const schema = String(formData.get("schema") ?? "").trim();
  const table = String(formData.get("table") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const permissive = String(formData.get("permissive") ?? "PERMISSIVE").trim().toUpperCase();
  const cmd = String(formData.get("cmd") ?? "ALL").trim().toUpperCase();
  const roles = parseRoles(String(formData.get("roles") ?? ""));
  const usingExpr = emptyToNull(String(formData.get("using_expr") ?? ""));
  const checkExpr = emptyToNull(String(formData.get("check_expr") ?? ""));

  try {
    if (!SAFE_IDENT.test(schema)) throw new Error("Invalid schema name");
    if (!SAFE_IDENT.test(table)) throw new Error("Invalid table name");
    if (!SAFE_IDENT.test(name)) throw new Error("Invalid policy name");
    if (!VALID_PERMISSIVE.has(permissive)) throw new Error("Invalid permissive value");
    if (!VALID_CMDS.has(cmd)) throw new Error("Invalid command");
    validateRoles(roles);

    // SELECT can't have WITH CHECK; INSERT can't have USING. Postgres will
    // tell us, but a friendlier message helps.
    if (cmd === "SELECT" && checkExpr) {
      throw new Error("SELECT policies cannot have a WITH CHECK clause");
    }
    if (cmd === "INSERT" && usingExpr) {
      throw new Error("INSERT policies cannot have a USING clause (use WITH CHECK instead)");
    }

    const sql = buildCreatePolicySql({
      schema, table, name, permissive: permissive as "PERMISSIVE" | "RESTRICTIVE",
      cmd: cmd as "ALL" | "SELECT" | "INSERT" | "UPDATE" | "DELETE",
      roles, usingExpr, checkExpr,
    });

    await pool().query(sql);
  } catch (e) {
    await audit({
      actor: session.email!,
      actorId: session.userId,
      role: "admin",
      action: "rls_policy.create",
      target: `${schema}.${table}.${name}`,
      success: false,
      ip,
      sessionId: session.sessionId ?? null,
      metadata: { error: (e as Error).message.split("\n")[0] },
    });
    redirectBack((e as Error).message);
  }

  await audit({
    actor: session.email!,
    actorId: session.userId,
    role: "admin",
    action: "rls_policy.create",
    target: `${schema}.${table}.${name}`,
    success: true,
    ip,
    sessionId: session.sessionId ?? null,
    metadata: { schema, table, name, cmd, permissive, roles, usingExpr, checkExpr },
  });

  revalidatePath("/admin/policies");
  redirectBack(undefined, `Created policy ${name} on ${schema}.${table}`);
}

export async function updatePolicy(formData: FormData) {
  const session = await requireAdmin();
  const ip = await clientIp();

  // Edit form carries the original schema/table/name as hidden fields so we
  // can DROP the old policy then CREATE the new one in a single transaction
  // — DROP + CREATE supports any change, including renaming or switching
  // permissive / cmd, which ALTER POLICY cannot do.
  const origSchema = String(formData.get("orig_schema") ?? "").trim();
  const origTable = String(formData.get("orig_table") ?? "").trim();
  const origName = String(formData.get("orig_name") ?? "").trim();

  const schema = String(formData.get("schema") ?? "").trim();
  const table = String(formData.get("table") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const permissive = String(formData.get("permissive") ?? "PERMISSIVE").trim().toUpperCase();
  const cmd = String(formData.get("cmd") ?? "ALL").trim().toUpperCase();
  const roles = parseRoles(String(formData.get("roles") ?? ""));
  const usingExpr = emptyToNull(String(formData.get("using_expr") ?? ""));
  const checkExpr = emptyToNull(String(formData.get("check_expr") ?? ""));

  const client = await pool().connect();
  try {
    if (!SAFE_IDENT.test(origSchema)) throw new Error("Invalid original schema");
    if (!SAFE_IDENT.test(origTable)) throw new Error("Invalid original table");
    if (!SAFE_IDENT.test(origName)) throw new Error("Invalid original policy name");
    if (!SAFE_IDENT.test(schema)) throw new Error("Invalid schema name");
    if (!SAFE_IDENT.test(table)) throw new Error("Invalid table name");
    if (!SAFE_IDENT.test(name)) throw new Error("Invalid policy name");
    if (!VALID_PERMISSIVE.has(permissive)) throw new Error("Invalid permissive value");
    if (!VALID_CMDS.has(cmd)) throw new Error("Invalid command");
    validateRoles(roles);
    if (cmd === "SELECT" && checkExpr) {
      throw new Error("SELECT policies cannot have a WITH CHECK clause");
    }
    if (cmd === "INSERT" && usingExpr) {
      throw new Error("INSERT policies cannot have a USING clause");
    }

    await client.query("BEGIN");
    await client.query(
      `DROP POLICY ${quoteIdent(origName)} ON ${quoteIdent(origSchema)}.${quoteIdent(origTable)}`,
    );
    await client.query(
      buildCreatePolicySql({
        schema, table, name,
        permissive: permissive as "PERMISSIVE" | "RESTRICTIVE",
        cmd: cmd as "ALL" | "SELECT" | "INSERT" | "UPDATE" | "DELETE",
        roles, usingExpr, checkExpr,
      }),
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    await audit({
      actor: session.email!,
      actorId: session.userId,
      role: "admin",
      action: "rls_policy.update",
      target: `${origSchema}.${origTable}.${origName}`,
      success: false,
      ip,
      sessionId: session.sessionId ?? null,
      metadata: { error: (e as Error).message.split("\n")[0] },
    });
    redirectBack((e as Error).message);
  } finally {
    client.release();
  }

  await audit({
    actor: session.email!,
    actorId: session.userId,
    role: "admin",
    action: "rls_policy.update",
    target: `${schema}.${table}.${name}`,
    success: true,
    ip,
    sessionId: session.sessionId ?? null,
    metadata: {
      from: { schema: origSchema, table: origTable, name: origName },
      to: { schema, table, name, cmd, permissive, roles, usingExpr, checkExpr },
    },
  });

  revalidatePath("/admin/policies");
  redirectBack(undefined, `Updated policy ${name} on ${schema}.${table}`);
}

export async function deletePolicy(formData: FormData) {
  const session = await requireAdmin();
  const ip = await clientIp();

  const schema = String(formData.get("schema") ?? "").trim();
  const table = String(formData.get("table") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();

  try {
    if (!SAFE_IDENT.test(schema)) throw new Error("Invalid schema name");
    if (!SAFE_IDENT.test(table)) throw new Error("Invalid table name");
    if (!SAFE_IDENT.test(name)) throw new Error("Invalid policy name");

    await pool().query(
      `DROP POLICY ${quoteIdent(name)} ON ${quoteIdent(schema)}.${quoteIdent(table)}`,
    );
  } catch (e) {
    await audit({
      actor: session.email!,
      actorId: session.userId,
      role: "admin",
      action: "rls_policy.delete",
      target: `${schema}.${table}.${name}`,
      success: false,
      ip,
      sessionId: session.sessionId ?? null,
      metadata: { error: (e as Error).message.split("\n")[0] },
    });
    redirectBack((e as Error).message);
  }

  await audit({
    actor: session.email!,
    actorId: session.userId,
    role: "admin",
    action: "rls_policy.delete",
    target: `${schema}.${table}.${name}`,
    success: true,
    ip,
    sessionId: session.sessionId ?? null,
  });

  revalidatePath("/admin/policies");
  redirectBack(undefined, `Deleted policy ${name}`);
}

export async function setTableRls(formData: FormData) {
  const session = await requireAdmin();
  const ip = await clientIp();

  const schema = String(formData.get("schema") ?? "").trim();
  const table = String(formData.get("table") ?? "").trim();
  // Three modes: 'enable', 'enable_force', 'disable'. Force = also bypass
  // owner exemption from policies (table owner is subject to policies too).
  const mode = String(formData.get("mode") ?? "enable").trim();

  try {
    if (!SAFE_IDENT.test(schema)) throw new Error("Invalid schema name");
    if (!SAFE_IDENT.test(table)) throw new Error("Invalid table name");
    if (!["enable", "enable_force", "disable"].includes(mode)) {
      throw new Error("Invalid mode");
    }

    const qualified = `${quoteIdent(schema)}.${quoteIdent(table)}`;
    if (mode === "enable") {
      await pool().query(`ALTER TABLE ${qualified} ENABLE ROW LEVEL SECURITY`);
      await pool().query(`ALTER TABLE ${qualified} NO FORCE ROW LEVEL SECURITY`);
    } else if (mode === "enable_force") {
      await pool().query(`ALTER TABLE ${qualified} ENABLE ROW LEVEL SECURITY`);
      await pool().query(`ALTER TABLE ${qualified} FORCE ROW LEVEL SECURITY`);
    } else {
      await pool().query(`ALTER TABLE ${qualified} DISABLE ROW LEVEL SECURITY`);
    }
  } catch (e) {
    await audit({
      actor: session.email!,
      actorId: session.userId,
      role: "admin",
      action: "rls_policy.toggle",
      target: `${schema}.${table}`,
      success: false,
      ip,
      sessionId: session.sessionId ?? null,
      metadata: { error: (e as Error).message.split("\n")[0], mode },
    });
    redirectBack((e as Error).message);
  }

  await audit({
    actor: session.email!,
    actorId: session.userId,
    role: "admin",
    action: "rls_policy.toggle",
    target: `${schema}.${table}`,
    success: true,
    ip,
    sessionId: session.sessionId ?? null,
    metadata: { mode },
  });

  revalidatePath("/admin/policies");
  redirectBack(undefined, `RLS ${mode === "disable" ? "disabled" : "enabled"} on ${schema}.${table}`);
}

// SQL builder kept here (not in the actions themselves) so the create flow
// and the update flow share the same code path.
function buildCreatePolicySql(p: {
  schema: string;
  table: string;
  name: string;
  permissive: "PERMISSIVE" | "RESTRICTIVE";
  cmd: "ALL" | "SELECT" | "INSERT" | "UPDATE" | "DELETE";
  roles: string[];
  usingExpr: string | null;
  checkExpr: string | null;
}): string {
  const parts: string[] = [
    `CREATE POLICY ${quoteIdent(p.name)}`,
    `  ON ${quoteIdent(p.schema)}.${quoteIdent(p.table)}`,
    `  AS ${p.permissive}`,
    `  FOR ${p.cmd}`,
    `  TO ${rolesClause(p.roles)}`,
  ];
  if (p.usingExpr) parts.push(`  USING (${p.usingExpr})`);
  if (p.checkExpr) parts.push(`  WITH CHECK (${p.checkExpr})`);
  return parts.join("\n");
}
