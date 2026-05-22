import { pool } from "./db";
import { decrypt, encrypt } from "./encryption";

export type FunctionEnvVarRow = {
  key: string;
  // The decrypted value. NOT exposed to the dashboard UI — only used inside
  // the executor when handing ctx.env to a running function.
  value: string;
  // Short preview safe to show in the admin UI: first 3 chars + mask.
  // Empty values render as "(empty)".
  preview: string;
  description: string | null;
  updated_at: Date;
  // True if the row is still stored in the legacy plaintext column. Useful
  // for an admin "upgrade now" UI element if you want to surface it.
  legacy_plaintext: boolean;
};

export const ENV_KEY = /^[A-Z_][A-Z0-9_]*$/;

type DbRow = {
  key: string;
  value: string | null;
  value_encrypted: string | null;
  description: string | null;
  updated_at: Date;
};

// Reads the underlying plaintext from whichever column has data. Prefers the
// encrypted column; falls back to legacy plaintext so existing rows keep
// working until they're re-saved.
function resolvePlaintext(row: DbRow): { plain: string; legacy: boolean } {
  if (row.value_encrypted) {
    return { plain: decrypt(row.value_encrypted), legacy: false };
  }
  return { plain: row.value ?? "", legacy: row.value != null };
}

// Builds the short preview shown in the admin UI. Short values (< 8 chars)
// reveal nothing; longer values reveal up to the first 3 characters.
function maskPreview(plain: string): string {
  if (plain.length === 0) return "(empty)";
  if (plain.length < 8) return `•••••• (${plain.length} chars)`;
  return `${plain.slice(0, 3)}•••••• (${plain.length} chars)`;
}

export async function listEnvVars(): Promise<FunctionEnvVarRow[]> {
  const { rows } = await pool().query<DbRow>(
    `SELECT key, value, value_encrypted, description, updated_at
       FROM _dashboard.function_env
       ORDER BY key`,
  );
  return rows.map((r) => {
    const { plain, legacy } = resolvePlaintext(r);
    return {
      key: r.key,
      value: plain,
      preview: maskPreview(plain),
      description: r.description,
      updated_at: r.updated_at,
      legacy_plaintext: legacy,
    };
  });
}

// Returns the merged env map suitable for handing to ctx.env at execution.
// Per-function vars (stored on _dashboard.functions.env) override globals.
export async function getEnvForFunction(
  perFunction: Record<string, string>,
): Promise<Record<string, string>> {
  const globals = await listEnvVars();
  const merged: Record<string, string> = {};
  for (const v of globals) merged[v.key] = v.value;
  for (const [k, v] of Object.entries(perFunction)) merged[k] = v;
  return merged;
}

export async function upsertEnvVar(
  input: { key: string; value: string; description?: string | null },
  updatedBy: string | null,
): Promise<void> {
  if (!ENV_KEY.test(input.key)) {
    throw new Error("Invalid env var name (UPPER_SNAKE_CASE)");
  }

  // Empty value on UPDATE = "keep what's saved". Implemented at the SQL
  // level so we don't accidentally clobber the existing ciphertext.
  const valuePresent = input.value.length > 0;
  const cipher = valuePresent ? encrypt(input.value) : null;

  await pool().query(
    `INSERT INTO _dashboard.function_env
       (key, value, value_encrypted, description, updated_by, updated_at)
     VALUES ($1, NULL, $2, $3, $4, now())
     ON CONFLICT (key) DO UPDATE
       SET
         -- When admin saves a new value: store the new ciphertext + clear
         -- any legacy plaintext.
         value           = CASE WHEN $2 IS NOT NULL THEN NULL
                                ELSE _dashboard.function_env.value
                           END,
         value_encrypted = CASE WHEN $2 IS NOT NULL THEN $2
                                ELSE _dashboard.function_env.value_encrypted
                           END,
         description     = EXCLUDED.description,
         updated_by      = EXCLUDED.updated_by,
         updated_at      = now()`,
    [input.key, cipher, input.description ?? null, updatedBy],
  );
}

export async function deleteEnvVar(key: string): Promise<void> {
  await pool().query(`DELETE FROM _dashboard.function_env WHERE key = $1`, [key]);
}
