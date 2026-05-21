import { pool } from "./db";

export async function getSetting<T = unknown>(key: string): Promise<T | null> {
  const { rows } = await pool().query<{ value: T }>(
    "SELECT value FROM _dashboard.settings WHERE key = $1",
    [key],
  );
  return rows[0]?.value ?? null;
}

export async function setSetting(
  key: string,
  value: unknown,
  updatedBy: string | null,
): Promise<void> {
  await pool().query(
    `INSERT INTO _dashboard.settings (key, value, updated_by, updated_at)
     VALUES ($1, $2::jsonb, $3, now())
     ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value,
           updated_by = EXCLUDED.updated_by,
           updated_at = now()`,
    [key, JSON.stringify(value), updatedBy],
  );
}
