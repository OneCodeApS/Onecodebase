-- Private schema for dashboard-only data. Not exposed to PostgREST.
CREATE SCHEMA IF NOT EXISTS _dashboard;
REVOKE ALL ON SCHEMA _dashboard FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA _dashboard TO dashboard_admin;

-- Users. Three roles:
--   admin      — OneCode operators. Full access, can manage other users.
--   read_write — can view and modify data through the dashboard UI.
--   read_only  — can only view data through the dashboard UI.
-- These roles gate the dashboard UI only. Application end-user permissions
-- (e.g. PostgREST JWT roles, RLS) are managed separately.
CREATE TABLE _dashboard.users (
	id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	email         text NOT NULL UNIQUE,
	password_hash text NOT NULL,
	role          text NOT NULL DEFAULT 'read_only'
		CHECK (role IN ('admin', 'read_write', 'read_only')),
	created_at    timestamptz NOT NULL DEFAULT now(),
	updated_at    timestamptz NOT NULL DEFAULT now(),
	disabled_at   timestamptz
);

-- Append-only audit trail. Every meaningful action by any user lands here
-- and in the host-side audit log file (see lib/audit.ts). prev_hash + hash
-- form a chain across rows so silent edits/deletes can be detected.
CREATE TABLE _dashboard.audit_log (
	id         bigserial PRIMARY KEY,
	created_at timestamptz NOT NULL DEFAULT now(),
	actor      text NOT NULL,
	actor_id   uuid REFERENCES _dashboard.users(id) ON DELETE SET NULL,
	role       text,
	action     text NOT NULL,
	target     text,
	statement  text,
	metadata   jsonb NOT NULL DEFAULT '{}'::jsonb,
	ip         inet,
	success    boolean NOT NULL DEFAULT true,
	session_id text,
	prev_hash  text,
	hash       text
);

CREATE INDEX audit_log_created_at_idx ON _dashboard.audit_log (created_at DESC);
CREATE INDEX audit_log_actor_id_idx   ON _dashboard.audit_log (actor_id, created_at DESC);

-- Runtime-editable settings (e.g., the audit log destination subdirectory).
CREATE TABLE _dashboard.settings (
	key        text PRIMARY KEY,
	value      jsonb NOT NULL,
	updated_at timestamptz NOT NULL DEFAULT now(),
	updated_by uuid REFERENCES _dashboard.users(id) ON DELETE SET NULL
);

INSERT INTO _dashboard.settings (key, value) VALUES ('audit_subdir', '"default"'::jsonb);

GRANT ALL ON ALL TABLES    IN SCHEMA _dashboard TO dashboard_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA _dashboard TO dashboard_admin;
