-- 0002_bucket_policies.sql
-- Adds per-bucket policy table for visibility, size cap, MIME whitelist.
-- Idempotent: safe on fresh installs and existing deployments.

BEGIN;

CREATE TABLE IF NOT EXISTS _dashboard.bucket_policies (
  bucket          text PRIMARY KEY,
  visibility      text NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('public', 'private')),
  max_upload_mb   integer NOT NULL DEFAULT 25 CHECK (max_upload_mb > 0),
  allowed_mime    text[],
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid REFERENCES _dashboard.users(id) ON DELETE SET NULL
);

GRANT ALL ON _dashboard.bucket_policies TO dashboard_admin;

COMMIT;
