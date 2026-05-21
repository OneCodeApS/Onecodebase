-- 0006_realtime_security_definer.sql
-- Re-create the realtime helpers with SECURITY DEFINER. Without this the
-- functions run as dashboard_admin which can CREATE TRIGGER (table grant
-- includes TRIGGER) but cannot DROP TRIGGER (requires table ownership).
-- That asymmetry made `disable_realtime` look like a no-op while
-- `enable_realtime` worked.
--
-- SET search_path is the recommended hardening for SECURITY DEFINER funcs.

BEGIN;

CREATE OR REPLACE FUNCTION _dashboard.enable_realtime(p_schema text, p_table text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  EXECUTE format(
    'DROP TRIGGER IF EXISTS realtime_notify_trigger ON %I.%I',
    p_schema, p_table
  );
  EXECUTE format(
    'CREATE TRIGGER realtime_notify_trigger '
    'AFTER INSERT OR UPDATE OR DELETE ON %I.%I '
    'FOR EACH ROW EXECUTE FUNCTION _dashboard.realtime_notify()',
    p_schema, p_table
  );
  INSERT INTO _dashboard.realtime_tables (schema, "table", enabled, updated_at)
  VALUES (p_schema, p_table, true, now())
  ON CONFLICT (schema, "table") DO UPDATE
    SET enabled = true, updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION _dashboard.disable_realtime(p_schema text, p_table text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  EXECUTE format(
    'DROP TRIGGER IF EXISTS realtime_notify_trigger ON %I.%I',
    p_schema, p_table
  );
  INSERT INTO _dashboard.realtime_tables (schema, "table", enabled, updated_at)
  VALUES (p_schema, p_table, false, now())
  ON CONFLICT (schema, "table") DO UPDATE
    SET enabled = false, updated_at = now();
END;
$$;

COMMIT;
