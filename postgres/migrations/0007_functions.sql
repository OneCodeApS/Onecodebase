-- 0007_functions.sql
-- Edge functions: server-side JavaScript stored in the DB, executed when
-- /functions/v1/<name> is hit. Admins edit the code in the dashboard.
-- Idempotent.
--
-- NOT a security sandbox — code runs with the same trust as the dashboard
-- process. Only admins can create/edit functions.

BEGIN;

CREATE TABLE IF NOT EXISTS _dashboard.functions (
  name          text PRIMARY KEY
                CHECK (name ~ '^[a-z][a-z0-9_-]{0,62}$'),
  description   text,
  enabled       boolean NOT NULL DEFAULT true,
  code          text NOT NULL DEFAULT '',
  env           jsonb NOT NULL DEFAULT '{}'::jsonb,
  timeout_ms    integer NOT NULL DEFAULT 5000
                CHECK (timeout_ms > 0 AND timeout_ms <= 60000),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    uuid REFERENCES _dashboard.users(id) ON DELETE SET NULL
);

GRANT ALL ON _dashboard.functions TO dashboard_admin;

COMMIT;
