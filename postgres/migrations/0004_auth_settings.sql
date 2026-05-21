-- 0004_auth_settings.sql
-- Adds global auth settings + per-provider config. Idempotent.

BEGIN;

-- Single-row table for global auth flags. The id = 1 CHECK keeps it that way.
CREATE TABLE IF NOT EXISTS auth.settings (
  id              smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  allow_signups   boolean NOT NULL DEFAULT true,
  confirm_email   boolean NOT NULL DEFAULT false,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid REFERENCES _dashboard.users(id) ON DELETE SET NULL
);

INSERT INTO auth.settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- One row per identity provider (email, microsoft, …). config is jsonb so
-- each provider can carry whatever fields it needs.
CREATE TABLE IF NOT EXISTS auth.providers (
  name        text PRIMARY KEY,
  enabled     boolean NOT NULL DEFAULT false,
  config      jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES _dashboard.users(id) ON DELETE SET NULL
);

-- Email/password is enabled by default so the existing flow keeps working.
INSERT INTO auth.providers (name, enabled, config)
VALUES ('email', true, '{}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Microsoft is disabled by default — admin must enter client_id/secret first.
INSERT INTO auth.providers (name, enabled, config)
VALUES ('microsoft', false, '{}'::jsonb)
ON CONFLICT (name) DO NOTHING;

GRANT ALL ON ALL TABLES    IN SCHEMA auth TO dashboard_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO dashboard_admin;

COMMIT;
