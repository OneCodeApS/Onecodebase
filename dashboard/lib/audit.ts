import { pool } from "./db";

export type AuditEntry = {
  actor: string;
  action: string;
  target?: string | null;
  statement?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  success?: boolean;
};

export async function audit(entry: AuditEntry): Promise<void> {
  await pool().query(
    `INSERT INTO _dashboard.admin_audit_log
       (actor, action, target, statement, metadata, ip, success)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
    [
      entry.actor,
      entry.action,
      entry.target ?? null,
      entry.statement ?? null,
      JSON.stringify(entry.metadata ?? {}),
      entry.ip ?? null,
      entry.success ?? true,
    ],
  );
}
