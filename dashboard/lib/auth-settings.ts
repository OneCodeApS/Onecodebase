import { pool } from "./db";

export type AuthSettings = {
  allow_signups: boolean;
  confirm_email: boolean;
};

export type AuthProvider = {
  name: string;
  enabled: boolean;
  config: Record<string, unknown>;
};

const DEFAULTS: AuthSettings = {
  allow_signups: true,
  confirm_email: false,
};

export async function getAuthSettings(): Promise<AuthSettings> {
  const { rows } = await pool().query<AuthSettings>(
    "SELECT allow_signups, confirm_email FROM auth.settings WHERE id = 1",
  );
  return rows[0] ?? DEFAULTS;
}

export async function setAuthSettings(
  next: AuthSettings,
  updatedBy: string | null,
): Promise<void> {
  await pool().query(
    `INSERT INTO auth.settings (id, allow_signups, confirm_email, updated_by, updated_at)
     VALUES (1, $1, $2, $3, now())
     ON CONFLICT (id) DO UPDATE
       SET allow_signups = EXCLUDED.allow_signups,
           confirm_email = EXCLUDED.confirm_email,
           updated_by    = EXCLUDED.updated_by,
           updated_at    = now()`,
    [next.allow_signups, next.confirm_email, updatedBy],
  );
}

export async function listProviders(): Promise<AuthProvider[]> {
  const { rows } = await pool().query<AuthProvider>(
    "SELECT name, enabled, config FROM auth.providers ORDER BY name",
  );
  return rows;
}

export async function getProvider(name: string): Promise<AuthProvider | null> {
  const { rows } = await pool().query<AuthProvider>(
    "SELECT name, enabled, config FROM auth.providers WHERE name = $1",
    [name],
  );
  return rows[0] ?? null;
}

export async function setProvider(
  name: string,
  next: { enabled: boolean; config?: Record<string, unknown> },
  updatedBy: string | null,
): Promise<void> {
  await pool().query(
    `INSERT INTO auth.providers (name, enabled, config, updated_by, updated_at)
     VALUES ($1, $2, COALESCE($3::jsonb, '{}'::jsonb), $4, now())
     ON CONFLICT (name) DO UPDATE
       SET enabled    = EXCLUDED.enabled,
           config     = COALESCE($3::jsonb, auth.providers.config),
           updated_by = EXCLUDED.updated_by,
           updated_at = now()`,
    [name, next.enabled, next.config ? JSON.stringify(next.config) : null, updatedBy],
  );
}

export async function isProviderEnabled(name: string): Promise<boolean> {
  const p = await getProvider(name);
  return !!p?.enabled;
}
