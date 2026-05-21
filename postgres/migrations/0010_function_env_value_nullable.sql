-- 0010_function_env_value_nullable.sql
-- Encrypted rows store their data in value_encrypted; the legacy value
-- column should be NULL for them. Drops the NOT NULL constraint that the
-- original schema had. Idempotent.

BEGIN;

ALTER TABLE _dashboard.function_env
  ALTER COLUMN value DROP NOT NULL;

ALTER TABLE _dashboard.function_env
  ALTER COLUMN value DROP DEFAULT;

COMMIT;
