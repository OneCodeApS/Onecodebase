-- 0012_audit_retention.sql
-- Seeds the audit-log retention setting. 30 days by default; 0 means keep
-- forever. The corresponding chain anchor (audit_chain_anchor) is written
-- lazily by the prune routine the first time rows are deleted. Idempotent.

BEGIN;

INSERT INTO _dashboard.settings (key, value)
VALUES ('audit_retention_days', '30'::jsonb)
ON CONFLICT (key) DO NOTHING;

COMMIT;
