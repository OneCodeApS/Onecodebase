-- 0013_pg_read_all_stats.sql
-- Grants the built-in pg_read_all_stats role to dashboard_admin so the
-- Home page's DB-health card can see connections from all roles (PostgREST's
-- authenticator, the postgres superuser, etc.), not just its own sessions.
-- pg_read_all_stats is a read-only stats privilege, not a data privilege.
-- Idempotent.

BEGIN;

GRANT pg_read_all_stats TO dashboard_admin;

COMMIT;
