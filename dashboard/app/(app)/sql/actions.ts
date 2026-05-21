"use server";

import { headers } from "next/headers";
import { pool } from "@/lib/db";
import { getSession } from "@/lib/session";
import { audit } from "@/lib/audit";

export type Success = {
  ok: true;
  command: string | null;
  rowCount: number | null;
  fields: string[];
  rows: Record<string, unknown>[];
  durationMs: number;
  truncated: boolean;
};

export type Failure = {
  ok: false;
  error: string;
  code: string | null;
};

export type QueryResult = Success | Failure;

// Cap on rows we return to the browser. Postgres still runs the full query
// (with statement_timeout from db.ts as the hard ceiling); we just don't
// serialise an unbounded result set into the response.
const MAX_ROWS = 500;

// Server-side gate for read_only users. NOT a security boundary against a
// malicious dashboard_admin user — the connection has full DB access. It's
// a UI guardrail. Real per-user DB role enforcement would require switching
// connection roles per session, which we don't do today.
const READ_ONLY_ALLOWED = /^\s*(SELECT|WITH|EXPLAIN|SHOW)\b/i;

async function clientIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip");
}

export async function runQuery(
  _prev: QueryResult | null,
  formData: FormData,
): Promise<QueryResult> {
  const session = await getSession();
  if (!session.userId) {
    return { ok: false, error: "Not signed in", code: null };
  }
  const role = session.role ?? "read_only";
  const sql = String(formData.get("sql") ?? "").trim();
  const ip = await clientIp();

  if (!sql) {
    return { ok: false, error: "Query is empty", code: null };
  }

  if (role === "read_only" && !READ_ONLY_ALLOWED.test(sql)) {
    const result: Failure = {
      ok: false,
      error: "Read-only users can only run SELECT, WITH, EXPLAIN, or SHOW statements.",
      code: null,
    };
    await audit({
      actor: session.email!,
      actorId: session.userId,
      role,
      action: "sql.run",
      statement: sql,
      success: false,
      ip,
      sessionId: session.sessionId ?? null,
      metadata: { reason: "role_blocked" },
    });
    return result;
  }

  const started = Date.now();
  try {
    const r = await pool().query(sql);
    const durationMs = Date.now() - started;

    const fields = r.fields?.map((f) => f.name) ?? [];
    const allRows = (r.rows ?? []) as Record<string, unknown>[];
    const truncated = allRows.length > MAX_ROWS;
    const rows = truncated ? allRows.slice(0, MAX_ROWS) : allRows;

    await audit({
      actor: session.email!,
      actorId: session.userId,
      role,
      action: "sql.run",
      statement: sql,
      success: true,
      ip,
      sessionId: session.sessionId ?? null,
      metadata: {
        command: r.command ?? null,
        row_count: r.rowCount ?? null,
        duration_ms: durationMs,
      },
    });

    return {
      ok: true,
      command: r.command ?? null,
      rowCount: r.rowCount ?? null,
      fields,
      rows,
      durationMs,
      truncated,
    };
  } catch (e) {
    const err = e as { message?: string; code?: string };
    const result: Failure = {
      ok: false,
      error: err.message ?? "Query failed",
      code: err.code ?? null,
    };
    await audit({
      actor: session.email!,
      actorId: session.userId,
      role,
      action: "sql.run",
      statement: sql,
      success: false,
      ip,
      sessionId: session.sessionId ?? null,
      metadata: {
        error_code: err.code ?? null,
        duration_ms: Date.now() - started,
      },
    });
    return result;
  }
}
