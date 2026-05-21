"use server";

import { headers } from "next/headers";
import { pool } from "@/lib/db";
import { getSession } from "@/lib/session";
import { audit, chainHash, type ChainBody } from "@/lib/audit";

export type VerifyResult =
  | { ok: true; verified: number; durationMs: number }
  | {
      ok: false;
      failedRowId: string;
      reason: string;
      expected: string | null;
      actual: string | null;
      verifiedBefore: number;
    };

async function clientIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip");
}

type AuditRow = {
  id: string;
  created_at: Date;
  actor: string;
  actor_id: string | null;
  role: ChainBody["role"];
  action: string;
  target: string | null;
  statement: string | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  success: boolean;
  session_id: string | null;
  prev_hash: string | null;
  hash: string | null;
};

export async function verifyChain(): Promise<VerifyResult> {
  const session = await getSession();
  if (session.role !== "admin") {
    throw new Error("Not authorised");
  }

  const started = Date.now();

  // Walk the whole log in ID order. The chain must be verified sequentially,
  // so streaming or pagination doesn't help here. If the log gets very large,
  // batching by id range would be the next optimisation.
  // host(ip) strips the implicit /32 or /128 subnet that Postgres adds to
  // inet values — the audit hash was computed with the bare address that the
  // app passed in, not the CIDR form ip::text would return.
  const { rows } = await pool().query<AuditRow>(
    `SELECT id, created_at, actor, actor_id, role, action, target, statement,
            metadata, host(ip) AS ip, success, session_id, prev_hash, hash
       FROM _dashboard.audit_log
       ORDER BY id ASC`,
  );

  let expectedPrev: string | null = null;
  let verified = 0;
  let result: VerifyResult = { ok: true, verified: 0, durationMs: 0 };

  for (const row of rows) {
    if (row.prev_hash !== expectedPrev) {
      result = {
        ok: false,
        failedRowId: row.id,
        reason: "prev_hash does not match the previous row's hash",
        expected: expectedPrev,
        actual: row.prev_hash,
        verifiedBefore: verified,
      };
      break;
    }

    // actor_id is intentionally excluded — see ChainBody in lib/audit.ts.
    const body: ChainBody = {
      created_at: row.created_at.toISOString(),
      actor: row.actor,
      role: row.role,
      action: row.action,
      target: row.target,
      statement: row.statement,
      metadata: row.metadata ?? {},
      ip: row.ip,
      success: row.success,
      session_id: row.session_id,
    };
    const computed = chainHash(row.prev_hash, body);
    if (computed !== row.hash) {
      result = {
        ok: false,
        failedRowId: row.id,
        reason: "stored hash does not match recomputed hash",
        expected: computed,
        actual: row.hash,
        verifiedBefore: verified,
      };
      break;
    }

    expectedPrev = row.hash;
    verified++;
  }

  if (result.ok) {
    result = { ok: true, verified, durationMs: Date.now() - started };
  }

  // Auditing the verifier run itself — meta but important for traceability.
  await audit({
    actor: session.email!,
    actorId: session.userId,
    role: "admin",
    action: "audit.verify",
    success: result.ok,
    ip: await clientIp(),
    sessionId: session.sessionId ?? null,
    metadata: result.ok
      ? { verified: result.verified, duration_ms: result.durationMs }
      : {
          failed_row_id: result.failedRowId,
          reason: result.reason,
          verified_before: result.verifiedBefore,
        },
  });

  return result;
}
