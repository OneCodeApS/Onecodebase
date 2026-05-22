"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { pool } from "@/lib/db";
import { quoteIdent, SAFE_IDENT, getDbFunctionByOid } from "@/lib/db-introspect";
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

// Guard so an admin doesn't paste a DROP / ALTER and execute it without
// realising. Anything multi-statement or starting with something else
// belongs in the SQL editor, which has its own audit path and intent.
const CREATE_FN_RX = /^\s*CREATE\s+(OR\s+REPLACE\s+)?(FUNCTION|PROCEDURE)\b/i;

function redirectList(error?: string, ok?: string): never {
  const params = new URLSearchParams();
  if (error) params.set("error", error);
  if (ok) params.set("ok", ok);
  const qs = params.toString();
  redirect(`/admin/db-functions${qs ? "?" + qs : ""}`);
}

function redirectDetail(oid: string, error?: string, ok?: string): never {
  const params = new URLSearchParams();
  if (error) params.set("error", error);
  if (ok) params.set("ok", ok);
  const qs = params.toString();
  redirect(`/admin/db-functions/${oid}${qs ? "?" + qs : ""}`);
}

// Save covers both "create new" (oid="new") and "update existing" (oid=<oid>).
// In both cases we just execute the DDL the user wrote. CREATE OR REPLACE is
// idempotent for the same signature; mismatched signatures create a new
// overload, same as raw psql behaviour.
export async function saveDbFunction(formData: FormData) {
  const session = await requireAdmin();
  const ip = await clientIp();

  const oid = String(formData.get("oid") ?? "new").trim();
  const definition = String(formData.get("definition") ?? "");

  try {
    if (!CREATE_FN_RX.test(definition)) {
      throw new Error(
        "Definition must start with CREATE [OR REPLACE] FUNCTION or PROCEDURE",
      );
    }
    await pool().query(definition);
  } catch (e) {
    const msg = (e as Error).message.split("\n")[0];
    await audit({
      actor: session.email!,
      actorId: session.userId,
      role: "admin",
      action: "db_function.save",
      target: oid,
      success: false,
      ip,
      sessionId: session.sessionId ?? null,
      metadata: { error: msg, oid },
    });
    if (oid === "new") {
      redirect(
        "/admin/db-functions/new?error=" + encodeURIComponent(msg),
      );
    }
    redirectDetail(oid, msg);
  }

  await audit({
    actor: session.email!,
    actorId: session.userId,
    role: "admin",
    action: "db_function.save",
    target: oid,
    success: true,
    ip,
    sessionId: session.sessionId ?? null,
    metadata: { oid, bytes: definition.length },
  });

  revalidatePath("/admin/db-functions");
  if (oid !== "new") revalidatePath(`/admin/db-functions/${oid}`);
  redirectList(undefined, "Saved");
}

export async function deleteDbFunction(formData: FormData) {
  const session = await requireAdmin();
  const ip = await clientIp();

  const oid = String(formData.get("oid") ?? "").trim();

  let target = oid;
  try {
    if (!/^\d+$/.test(oid)) throw new Error("Invalid function oid");

    // Look up identity from oid so we can build a safe DROP that survives
    // overloading. The args string from pg_get_function_identity_arguments
    // is the canonical signature form Postgres expects in DROP FUNCTION.
    const fn = await getDbFunctionByOid(oid);
    if (!fn) throw new Error("Function not found");
    if (!SAFE_IDENT.test(fn.schema)) throw new Error("Unsafe schema identifier");
    if (!SAFE_IDENT.test(fn.name)) throw new Error("Unsafe function identifier");

    target = `${fn.schema}.${fn.name}(${fn.args})`;

    const verb = fn.kind === "procedure" ? "PROCEDURE" : "FUNCTION";
    await pool().query(
      `DROP ${verb} ${quoteIdent(fn.schema)}.${quoteIdent(fn.name)}(${fn.args})`,
    );
  } catch (e) {
    const msg = (e as Error).message.split("\n")[0];
    await audit({
      actor: session.email!,
      actorId: session.userId,
      role: "admin",
      action: "db_function.delete",
      target,
      success: false,
      ip,
      sessionId: session.sessionId ?? null,
      metadata: { error: msg, oid },
    });
    redirectList(msg);
  }

  await audit({
    actor: session.email!,
    actorId: session.userId,
    role: "admin",
    action: "db_function.delete",
    target,
    success: true,
    ip,
    sessionId: session.sessionId ?? null,
    metadata: { oid },
  });

  revalidatePath("/admin/db-functions");
  redirectList(undefined, `Deleted ${target}`);
}
