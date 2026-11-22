-- Run as database administrator only after migration 0005. No credentials here.
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='clinic_auth_reader') THEN
    CREATE ROLE clinic_auth_reader NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
  END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='clinic_auth_reader'
     AND (rolsuper OR rolbypassrls OR rolcanlogin)) THEN
    RAISE EXCEPTION 'Auth reader must be a restricted NOLOGIN role';
  END IF;
END $$;
-- Auth enables RLS with no browser policies on sessions. A private owner-view
-- projects only the three required columns; no managed policy is changed.
CREATE OR REPLACE VIEW clinic.auth_session_projection WITH (security_barrier=true)
AS SELECT id,user_id,not_after FROM auth.sessions;
DO $$ DECLARE owner_name text; BEGIN
 SELECT pg_get_userbyid(c.relowner) INTO owner_name FROM pg_class c
 JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='auth' AND c.relname='sessions';
 IF owner_name IS NULL THEN RAISE EXCEPTION 'Auth sessions table missing'; END IF;
 EXECUTE format('GRANT USAGE,CREATE ON SCHEMA clinic TO %I',owner_name);
 EXECUTE format('ALTER VIEW clinic.auth_session_projection OWNER TO %I',owner_name);
 EXECUTE format('REVOKE CREATE ON SCHEMA clinic FROM %I',owner_name);
END $$;
REVOKE ALL ON clinic.auth_session_projection FROM PUBLIC,anon,authenticated,clinic_runtime;
REVOKE ALL ON auth.sessions FROM clinic_auth_reader;
GRANT SELECT ON clinic.auth_session_projection TO clinic_auth_reader;
GRANT USAGE,CREATE ON SCHEMA clinic TO clinic_auth_reader;
CREATE OR REPLACE FUNCTION clinic.auth_session_active(user_uuid UUID, session_uuid UUID)
RETURNS boolean LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $$ SELECT EXISTS(SELECT 1 FROM clinic.auth_session_projection s
  WHERE s.id=session_uuid AND s.user_id=user_uuid
  AND (s.not_after IS NULL OR s.not_after>pg_catalog.now())) $$;
ALTER FUNCTION clinic.auth_session_active(UUID,UUID) OWNER TO clinic_auth_reader;
REVOKE CREATE ON SCHEMA clinic FROM clinic_auth_reader;
REVOKE ALL ON FUNCTION clinic.auth_session_active(UUID,UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION clinic.auth_session_active(UUID,UUID) FROM anon,authenticated;
GRANT EXECUTE ON FUNCTION clinic.auth_session_active(UUID,UUID) TO clinic_runtime;
COMMIT;
