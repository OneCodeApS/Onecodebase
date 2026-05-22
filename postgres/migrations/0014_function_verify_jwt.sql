-- 0014_function_verify_jwt.sql
-- Adds the verify_jwt flag to _dashboard.functions. When true (the safe
-- default), the HTTP handler at /functions/v1/<name> requires a valid JWT
-- (signed with PGRST_JWT_SECRET) in the Authorization header. Admins can
-- opt a specific function back to public from the dashboard.
-- Idempotent.

BEGIN;

ALTER TABLE _dashboard.functions
  ADD COLUMN IF NOT EXISTS verify_jwt boolean NOT NULL DEFAULT true;

COMMIT;
