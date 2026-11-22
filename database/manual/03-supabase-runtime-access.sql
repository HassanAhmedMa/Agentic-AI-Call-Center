-- CUTOVER ONLY: after restoring clinic-private-schema.dump into postgres.
-- Provision LOGIN credentials privately first. No passwords belong in this file.
-- Required roles: clinic_migrator and clinic_runtime, neither SUPERUSER nor BYPASSRLS.
-- Run as postgres with membership in clinic_migrator for ownership transfers.
BEGIN;
REVOKE ALL ON SCHEMA clinic FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA clinic FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA clinic FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA clinic TO clinic_runtime;
GRANT CONNECT ON DATABASE postgres TO clinic_runtime, clinic_migrator;
ALTER SCHEMA clinic OWNER TO clinic_migrator;

DO $ownership$
DECLARE item record;
BEGIN
 FOR item IN SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
             WHERE n.nspname='clinic' AND t.typtype='e' LOOP
  EXECUTE format('ALTER TYPE clinic.%I OWNER TO clinic_migrator', item.typname);
 END LOOP;
 FOR item IN SELECT tablename FROM pg_tables WHERE schemaname='clinic' LOOP
  EXECUTE format('ALTER TABLE clinic.%I ENABLE ROW LEVEL SECURITY', item.tablename);
  IF item.tablename='alembic_version' THEN
   EXECUTE format('GRANT SELECT ON clinic.%I TO clinic_runtime', item.tablename);
   EXECUTE format('CREATE POLICY backend_access ON clinic.%I FOR SELECT TO clinic_runtime USING (true)', item.tablename);
  ELSE
   EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON clinic.%I TO clinic_runtime', item.tablename);
   EXECUTE format('CREATE POLICY backend_access ON clinic.%I TO clinic_runtime USING (true) WITH CHECK (true)', item.tablename);
  END IF;
  EXECUTE format('ALTER TABLE clinic.%I OWNER TO clinic_migrator', item.tablename);
 END LOOP;
 FOR item IN SELECT sequencename FROM pg_sequences WHERE schemaname='clinic' LOOP
  EXECUTE format('ALTER SEQUENCE clinic.%I OWNER TO clinic_migrator', item.sequencename);
 END LOOP;
END
$ownership$;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA clinic TO clinic_runtime;
-- Future migrations must explicitly enable RLS and add backend policies.
ALTER DEFAULT PRIVILEGES FOR ROLE clinic_migrator IN SCHEMA clinic
 GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO clinic_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE clinic_migrator IN SCHEMA clinic
 GRANT USAGE, SELECT ON SEQUENCES TO clinic_runtime;
COMMIT;
