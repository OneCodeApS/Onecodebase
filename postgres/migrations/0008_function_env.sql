-- 0008_function_env.sql
-- Global env vars available to every edge function as ctx.env.<KEY>.
-- Idempotent.

BEGIN;

CREATE TABLE IF NOT EXISTS _dashboard.function_env (
  key          text PRIMARY KEY
               CHECK (key ~ '^[A-Z_][A-Z0-9_]*$'),
  value        text NOT NULL DEFAULT '',
  description  text,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid REFERENCES _dashboard.users(id) ON DELETE SET NULL
);

GRANT ALL ON _dashboard.function_env TO dashboard_admin;

COMMIT;
