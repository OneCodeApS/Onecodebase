import { pool } from "./db";

// Identifier names that are safe to pass to enable/disable_realtime SQL
// helpers. The helpers themselves quote with %I, but we also reject anything
// that doesn't look like a normal Postgres identifier so we fail fast.
export const SAFE_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export type RealtimeTable = {
  schema: string;
  table: string;
  enabled: boolean;
};

export async function listRealtimeStatus(): Promise<RealtimeTable[]> {
  // Joins every base table in every non-system schema against the dashboard's
  // realtime_tables table so the UI can show one row per table with its
  // current toggle state.
  const { rows } = await pool().query<RealtimeTable>(
    `SELECT n.nspname AS schema,
            c.relname AS "table",
            COALESCE(r.enabled, false) AS enabled
       FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       LEFT JOIN _dashboard.realtime_tables r
              ON r.schema = n.nspname AND r."table" = c.relname
      WHERE c.relkind = 'r'
        AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND n.nspname NOT LIKE 'pg_toast%'
        AND n.nspname NOT LIKE 'pg_temp%'
      ORDER BY n.nspname, c.relname`,
  );
  return rows;
}

export async function enableRealtime(schema: string, table: string): Promise<void> {
  if (!SAFE_IDENT.test(schema) || !SAFE_IDENT.test(table)) {
    throw new Error("Invalid identifier");
  }
  await pool().query("SELECT _dashboard.enable_realtime($1, $2)", [schema, table]);
}

export async function disableRealtime(schema: string, table: string): Promise<void> {
  if (!SAFE_IDENT.test(schema) || !SAFE_IDENT.test(table)) {
    throw new Error("Invalid identifier");
  }
  await pool().query("SELECT _dashboard.disable_realtime($1, $2)", [schema, table]);
}

export async function isRealtimeEnabled(schema: string, table: string): Promise<boolean> {
  const { rows } = await pool().query<{ enabled: boolean }>(
    `SELECT enabled FROM _dashboard.realtime_tables
      WHERE schema = $1 AND "table" = $2`,
    [schema, table],
  );
  return rows[0]?.enabled ?? false;
}
