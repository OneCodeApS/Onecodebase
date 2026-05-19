-- Private schema for dashboard-only data. Not exposed to PostgREST.
CREATE SCHEMA IF NOT EXISTS _dashboard;
REVOKE ALL ON SCHEMA _dashboard FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA _dashboard TO dashboard_admin;

-- Single admin user. (MVP: one admin. RBAC is explicitly out of scope.)
CREATE TABLE _dashboard.admins (
	id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	email      text NOT NULL UNIQUE,
	password_hash text NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now()
);

-- Every mutating dashboard action is appended here.
CREATE TABLE _dashboard.admin_audit_log (
	id         bigserial PRIMARY KEY,
	created_at timestamptz NOT NULL DEFAULT now(),
	actor      text NOT NULL,           -- admin email at time of action
	action     text NOT NULL,           -- short verb, e.g. 'login', 'sql.execute', 'table.create'
	target     text,                    -- schema.object or bucket/key, when applicable
	statement  text,                    -- raw SQL for SQL editor; null otherwise
	metadata   jsonb NOT NULL DEFAULT '{}'::jsonb,
	ip         inet,
	success    boolean NOT NULL DEFAULT true
);

CREATE INDEX admin_audit_log_created_at_idx
	ON _dashboard.admin_audit_log (created_at DESC);

GRANT ALL ON ALL TABLES IN SCHEMA _dashboard TO dashboard_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA _dashboard TO dashboard_admin;
