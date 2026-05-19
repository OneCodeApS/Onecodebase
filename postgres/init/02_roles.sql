-- Three logical roles used by the platform:
--   authenticator   — PostgREST connects as this; SET ROLE to anon/service_role
--   anon            — unauthenticated PostgREST requests
--   service_role    — authenticated PostgREST requests with a service JWT (bypasses RLS)
--   dashboard_admin — the admin dashboard's database connection (DDL, audit, etc.)
--
-- Passwords are read from the container environment via psql's \getenv.

\getenv authenticator_pw AUTHENTICATOR_PASSWORD
\getenv dashboard_admin_pw DASHBOARD_ADMIN_PASSWORD

-- anon: unauthenticated PostgREST traffic. NOLOGIN so it cannot connect directly.
CREATE ROLE anon NOLOGIN NOINHERIT;

-- service_role: bypasses RLS. NOLOGIN; reached via SET ROLE from authenticator.
CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;

-- authenticator: PostgREST connects as this. NOINHERIT so it must explicitly SET ROLE.
CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD :'authenticator_pw';
GRANT anon TO authenticator;
GRANT service_role TO authenticator;

-- dashboard_admin: the dashboard's connection. Broad privileges within this DB.
-- Crucially, authenticator does NOT have access to this role, so it is unreachable
-- via PostgREST.
CREATE ROLE dashboard_admin LOGIN PASSWORD :'dashboard_admin_pw';
GRANT ALL ON DATABASE postgres TO dashboard_admin;

-- Default privileges on the public schema for the API roles.
GRANT USAGE ON SCHEMA public TO anon, service_role;

-- service_role gets blanket access on public; per-object grants for anon are made
-- alongside each table definition.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
	GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
	GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
	GRANT ALL ON FUNCTIONS TO service_role;
