-- 0015_role_statement_timeout.sql
-- Statement timeout is normally set client-side via the connection pool's
-- startup parameters. With PgBouncer in transaction mode those parameters
-- are dropped (added to ignore_startup_parameters), so we enforce them on
-- the role itself instead. Idempotent.

BEGIN;

ALTER ROLE dashboard_admin SET statement_timeout = '30s';
ALTER ROLE authenticator   SET statement_timeout = '30s';

COMMIT;
