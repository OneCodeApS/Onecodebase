-- 0011_cron_jobs.sql
-- Cron-scheduled invocations of edge functions. Idempotent.

BEGIN;

CREATE TABLE IF NOT EXISTS _dashboard.cron_jobs (
  name              text PRIMARY KEY
                    CHECK (name ~ '^[a-z][a-z0-9_-]{0,62}$'),
  schedule          text NOT NULL,
  function_name     text NOT NULL,
  enabled           boolean NOT NULL DEFAULT true,
  last_run_at       timestamptz,
  last_status       text CHECK (last_status IN ('success','failed','running')),
  last_error        text,
  last_duration_ms  integer,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        uuid REFERENCES _dashboard.users(id) ON DELETE SET NULL,
  FOREIGN KEY (function_name) REFERENCES _dashboard.functions(name) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS cron_jobs_enabled_idx
  ON _dashboard.cron_jobs (enabled) WHERE enabled = true;

GRANT ALL ON _dashboard.cron_jobs TO dashboard_admin;

COMMIT;
