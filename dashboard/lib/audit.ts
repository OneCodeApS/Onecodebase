import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { pool } from "./db";
import { getSetting } from "./settings";
import type { UserRole } from "./session";

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

type ChainBody = {
  created_at: string;
  actor: string;
  actor_id: string | null;
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
// body always produces the same hash. Required for any future verifier.
function canonicalize(o: unknown): string {
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

function chainHash(prev: string | null, body: ChainBody): string {
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

    const prev = await client.query<{ hash: string | null }>(
      "SELECT hash FROM _dashboard.audit_log ORDER BY id DESC LIMIT 1",
    );
    prevHash = prev.rows[0]?.hash ?? null;

    const now = new Date();
    body = {
      created_at: now.toISOString(),
      actor: entry.actor,
      actor_id: entry.actorId ?? null,
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

    await client.query(
      `INSERT INTO _dashboard.audit_log
         (created_at, actor, actor_id, role, action, target, statement,
          metadata, ip, success, session_id, prev_hash, hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13)`,
      [
        body.created_at,
        body.actor,
        body.actor_id,
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
