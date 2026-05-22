-- 0009_function_env_encryption.sql
-- Adds a value_encrypted column for AES-256-GCM ciphertext. New writes go
-- here; the old `value` column is kept for backward-compat reads until all
-- rows have been re-saved through the dashboard. Idempotent.

BEGIN;

ALTER TABLE _dashboard.function_env
  ADD COLUMN IF NOT EXISTS value_encrypted text;

COMMIT;
