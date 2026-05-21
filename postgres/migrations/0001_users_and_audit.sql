-- 0001_users_and_audit.sql
-- Introduces multi-user model (admin/guest) and extends the audit log
-- with hash-chained file-friendly columns. Idempotent: safe on both
-- fresh installs and existing v0.1.0 installs.

BEGIN;

-- 1. Rename admins → users (if it exists under the old name).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = '_dashboard' AND table_name = 'admins'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = '_dashboard' AND table_name = 'users'
  ) THEN
    ALTER TABLE _dashboard.admins RENAME TO users;
  END IF;
END $$;

-- 2. Ensure the users table exists in its final shape (clean install).
CREATE TABLE IF NOT EXISTS _dashboard.users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  disabled_at   timestamptz
);

-- 3. Add columns that may be missing on a migrated table.
ALTER TABLE _dashboard.users ADD COLUMN IF NOT EXISTS role        text;
ALTER TABLE _dashboard.users ADD COLUMN IF NOT EXISTS updated_at  timestamptz NOT NULL DEFAULT now();
ALTER TABLE _dashboard.users ADD COLUMN IF NOT EXISTS disabled_at timestamptz;

-- 4. Backfill role for any pre-existing rows (they were all admins).
UPDATE _dashboard.users SET role = 'admin' WHERE role IS NULL;

ALTER TABLE _dashboard.users ALTER COLUMN role SET DEFAULT 'guest';
ALTER TABLE _dashboard.users ALTER COLUMN role SET NOT NULL;

ALTER TABLE _dashboard.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE _dashboard.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'guest'));

-- 5. Rename admin_audit_log → audit_log (it logs everyone now).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = '_dashboard' AND table_name = 'admin_audit_log'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = '_dashboard' AND table_name = 'audit_log'
  ) THEN
    ALTER TABLE _dashboard.admin_audit_log RENAME TO audit_log;
    -- Keep existing indexes; they renamed implicitly.
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS _dashboard.audit_log (
  id         bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  actor      text NOT NULL,
  actor_id   uuid REFERENCES _dashboard.users(id) ON DELETE SET NULL,
  role       text,
  action     text NOT NULL,
  target     text,
  statement  text,
  metadata   jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip         inet,
  success    boolean NOT NULL DEFAULT true,
  session_id text,
  prev_hash  text,
  hash       text
);

-- 6. New audit columns on a migrated table.
ALTER TABLE _dashboard.audit_log ADD COLUMN IF NOT EXISTS actor_id   uuid REFERENCES _dashboard.users(id) ON DELETE SET NULL;
ALTER TABLE _dashboard.audit_log ADD COLUMN IF NOT EXISTS role       text;
ALTER TABLE _dashboard.audit_log ADD COLUMN IF NOT EXISTS session_id text;
ALTER TABLE _dashboard.audit_log ADD COLUMN IF NOT EXISTS prev_hash  text;
ALTER TABLE _dashboard.audit_log ADD COLUMN IF NOT EXISTS hash       text;

CREATE INDEX IF NOT EXISTS audit_log_created_at_idx
  ON _dashboard.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor_id_idx
  ON _dashboard.audit_log (actor_id, created_at DESC);

-- 7. Key/value settings for things an admin can edit at runtime.
CREATE TABLE IF NOT EXISTS _dashboard.settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES _dashboard.users(id) ON DELETE SET NULL
);

INSERT INTO _dashboard.settings (key, value)
VALUES ('audit_subdir', '"default"'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 8. Re-assert dashboard_admin grants now that new objects exist.
GRANT ALL ON ALL TABLES    IN SCHEMA _dashboard TO dashboard_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA _dashboard TO dashboard_admin;

COMMIT;
