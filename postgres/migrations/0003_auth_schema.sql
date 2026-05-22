-- 0003_auth_schema.sql
-- Application end-user authentication. Strictly separate from _dashboard
-- which is for OneCode operators. Idempotent.

BEGIN;

CREATE SCHEMA IF NOT EXISTS auth;
REVOKE ALL ON SCHEMA auth FROM PUBLIC;
GRANT USAGE ON SCHEMA auth TO dashboard_admin;

CREATE TABLE IF NOT EXISTS auth.users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email               text UNIQUE NOT NULL,
  encrypted_password  text,
  email_verified_at   timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  last_sign_in_at     timestamptz,
  disabled_at         timestamptz,
  raw_user_metadata   jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS users_email_idx ON auth.users (lower(email));

CREATE TABLE IF NOT EXISTS auth.identities (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider            text NOT NULL,
  provider_user_id    text NOT NULL,
  identity_data       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS identities_user_id_idx ON auth.identities (user_id);

CREATE TABLE IF NOT EXISTS auth.sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  refresh_token_hash  text UNIQUE NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL,
  revoked_at          timestamptz,
  user_agent          text,
  ip                  inet
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON auth.sessions (user_id);

GRANT ALL ON ALL TABLES    IN SCHEMA auth TO dashboard_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO dashboard_admin;

COMMIT;
