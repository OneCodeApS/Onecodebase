import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { pool } from "./db";
import { getSetting } from "./settings";
import type { UserRole } from "./session";

// Settings key that holds the hash of the most-recently-pruned row. The
// chain verifier uses this as its initial expectedPrev so verification
// still works on the retained window after pruning.
export const CHAIN_ANCHOR_KEY = "audit_chain_anchor";

// Constant key for the Postgres advisory lock that serialises audit-log
// inserts. Ensures only one writer at a time computes prev_hash → hash,
// so the chain is never corrupted by concurrent inserts.
const CHAIN_LOCK_KEY = 8423479237;

export type AuditEntry = {
  actor: string;
  actorId?: string | null;
  role?: UserRole | null;
  action: string;
  target?: string | null;
  statement?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  success?: boolean;
  sessionId?: string | null;
};

// Exported so the chain verifier can reuse the exact same canonical form
// and hash algorithm — any divergence would cause false positives.
//
// Note: actor_id is intentionally NOT part of the hashed body. The audit_log
// FK has ON DELETE SET NULL, so deleting a user mutates audit_log.actor_id
// for their existing rows — that would silently invalidate the chain hash for
// every one of their actions. `actor` (email) is the immutable identifier we
// hash; actor_id remains a column for joins, but it's outside the proof.
export type ChainBody = {
  created_at: string;
  actor: string;
  role: UserRole | null;
  action: string;
  target: string | null;
  statement: string | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  success: boolean;
  session_id: string | null;
};

// Deterministic stringify (sorted keys, recursive) so the same logical
// body always produces the same hash.
export function canonicalize(o: unknown): string {
  if (o === null || typeof o !== "object") return JSON.stringify(o);
  if (Array.isArray(o)) return "[" + o.map(canonicalize).join(",") + "]";
  const obj = o as Record<string, unknown>;
  return (
    "{" +
    Object.keys(obj)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + canonicalize(obj[k]))
      .join(",") +
    "}"
  );
}

export function chainHash(prev: string | null, body: ChainBody): string {
  return crypto
    .createHash("sha256")
    .update((prev ?? "") + canonicalize(body))
    .digest("hex");
}

export async function audit(entry: AuditEntry): Promise<void> {
  const client = await pool().connect();
  let body: ChainBody;
  let prevHash: string | null;
  let hash: string;
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [CHAIN_LOCK_KEY]);

    // Resolve actor_id: if the referenced user no longer exists (deleted user,
    // stale dev session after a `down -v`, etc.), store NULL so the FK doesn't
    // reject the insert. The actor email is still recorded, so the row is not
    // lost. Mirrors the FK's existing ON DELETE SET NULL behaviour.
    let actorId: string | null = entry.actorId ?? null;
    if (actorId !== null) {
      const exists = await client.query<{ id: string }>(
        "SELECT id FROM _dashboard.users WHERE id = $1",
        [actorId],
      );
      if (exists.rows.length === 0) actorId = null;
    }

    const prev = await client.query<{ hash: string | null }>(
      "SELECT hash FROM _dashboard.audit_log ORDER BY id DESC LIMIT 1",
    );
    prevHash = prev.rows[0]?.hash ?? null;

    // Edge case: retention pruned every row. Chain to the stored anchor
    // (the last pruned row's hash) so history isn't silently restarted.
    if (prevHash === null) {
      const anchor = await client.query<{ value: string | null }>(
        "SELECT value::text AS value FROM _dashboard.settings WHERE key = $1",
        [CHAIN_ANCHOR_KEY],
      );
      const raw = anchor.rows[0]?.value;
      if (raw) {
        // value is stored as a JSON string; strip the wrapping quotes.
        try {
          const parsed = JSON.parse(raw);
          if (typeof parsed === "string") prevHash = parsed;
        } catch {
          // Malformed anchor — fall back to genesis. Better than throwing
          // and blocking the audit insert.
        }
      }
    }

    const now = new Date();
    body = {
      created_at: now.toISOString(),
      actor: entry.actor,
      role: entry.role ?? null,
      action: entry.action,
      target: entry.target ?? null,
      statement: entry.statement ?? null,
      metadata: entry.metadata ?? {},
      ip: entry.ip ?? null,
      success: entry.success ?? true,
      session_id: entry.sessionId ?? null,
    };
    hash = chainHash(prevHash, body);

    // actor_id is stored as a column for joins but is not part of the hashed
    // body (see ChainBody for the reason).
    await client.query(
      `INSERT INTO _dashboard.audit_log
         (created_at, actor, actor_id, role, action, target, statement,
          metadata, ip, success, session_id, prev_hash, hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13)`,
      [
        body.created_at,
        body.actor,
        actorId,
        body.role,
        body.action,
        body.target,
        body.statement,
        JSON.stringify(body.metadata),
        body.ip,
        body.success,
        body.session_id,
        prevHash,
        hash,
      ],
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }

  // The file write is a best-effort defense-in-depth copy. If it fails,
  // the chained row is still in Postgres — but the operator should be
  // told, because losing the file means losing the off-DB audit trail.
  try {
    await writeToFile({ ...body, prev_hash: prevHash, hash });
  } catch (e) {
    console.error("audit: file write failed", e);
  }
}

async function writeToFile(
  row: ChainBody & { prev_hash: string | null; hash: string },
): Promise<void> {
  const root = process.env.AUDIT_LOG_DIR ?? "/audit";
  const rawSubdir = (await getSetting<string>("audit_subdir")) ?? "default";
  const safeSubdir = rawSubdir.replace(/[^a-zA-Z0-9._-]/g, "_") || "default";
  const dir = path.join(root, safeSubdir);
  await fs.mkdir(dir, { recursive: true });

  const day = row.created_at.slice(0, 10);
  const file = path.join(dir, `audit-${day}.jsonl`);
  await fs.appendFile(file, JSON.stringify(row) + "\n", { encoding: "utf8" });
}
