#!/usr/bin/env bash
# Rehearsal only: never changes the running backend or restores into postgres.
set -euo pipefail
umask 077
source_container=agentic_clinic_postgres
target_container=supabase-db
stamp=$(date -u +%Y%m%dT%H%M%SZ)_$$
test_db=clinic_rehearsal_$stamp
test_role=clinic_rehearsal_runtime_$stamp
backup_dir="$HOME/clinic-migration-backups/$stamp"
mkdir -p "$backup_dir"
created=0
role_created=0
cleanup() {
  if [[ $created == 1 ]]; then
    docker exec "$target_container" dropdb -U postgres "$test_db"
  fi
  if [[ $role_created == 1 ]]; then
    docker exec "$target_container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "DROP ROLE \"$test_role\";" >/dev/null
  fi
}
trap cleanup EXIT

revision=$(docker exec "$source_container" psql -U clinic_user -d clinic_db -Atc 'SELECT version_num FROM public.alembic_version')
[[ $revision == 0003_identity ]] || { echo 'Unexpected source revision; stopped.'; exit 1; }
existing=$(docker exec "$target_container" psql -U postgres -d postgres -Atc "SELECT count(*) FROM pg_namespace WHERE nspname='clinic'")
[[ $existing == 0 ]] || { echo 'Target clinic schema exists; stopped for review.'; exit 1; }

# Consistent snapshot of all source schema/data, with restricted backup permissions.
docker exec "$source_container" pg_dump -U clinic_user -d clinic_db --format=custom --no-owner --no-acl > "$backup_dir/source.dump"
docker exec "$target_container" createdb -U postgres -T template0 "$test_db"
created=1
docker exec -i "$target_container" pg_restore -U postgres -d "$test_db" --exit-on-error --no-owner --no-acl < "$backup_dir/source.dump"

# Compare every implemented table, including sensitive session/challenge tables;
# print only success, never contents, tokens, codes or credentials.
tables=(alembic_version specialties doctors services patients conversation_sessions patient_sessions verification_challenges rate_limit_events)
for table in "${tables[@]}"; do
  query="SELECT count(*)::text || ':' || md5(coalesce(string_agg(row_to_json(t)::text, E'\\n' ORDER BY row_to_json(t)::text),'')) FROM public.$table t"
  before=$(docker exec "$source_container" psql -U clinic_user -d clinic_db -Atc "$query")
  after=$(docker exec "$target_container" psql -U postgres -d "$test_db" -Atc "$query")
  [[ $before == "$after" ]] || { echo "Source changed or copy mismatch: $table. Repeat during write pause."; exit 1; }
done

# Rename the isolated database's schema; PostgreSQL updates object references,
# avoiding unsafe text replacement in patient data or dump contents.
docker exec "$target_container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 -c 'ALTER SCHEMA public RENAME TO clinic; REVOKE ALL ON SCHEMA clinic FROM PUBLIC; REVOKE ALL ON SCHEMA clinic FROM anon, authenticated;' >/dev/null

# Exercise a non-owner backend role under RLS; temporary role is removed on exit.
docker exec "$target_container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE ROLE \"$test_role\" NOLOGIN NOSUPERUSER NOBYPASSRLS; GRANT \"$test_role\" TO postgres;" >/dev/null
role_created=1
docker exec -i "$target_container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 > /dev/null <<SQL
GRANT USAGE ON SCHEMA clinic TO "$test_role";
GRANT SELECT ON clinic.alembic_version TO "$test_role";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA clinic TO "$test_role";
DO \$policy\$
DECLARE t record;
BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='clinic' LOOP
  EXECUTE format('ALTER TABLE clinic.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  EXECUTE format('CREATE POLICY backend_access ON clinic.%I TO %I USING (true) WITH CHECK (true)', t.tablename, '$test_role');
  IF t.tablename <> 'alembic_version' THEN
   EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON clinic.%I TO %I', t.tablename, '$test_role');
  END IF;
 END LOOP;
END
\$policy\$;
SET ROLE "$test_role";
SET search_path TO clinic, pg_catalog;
SELECT version_num FROM alembic_version;
SELECT count(*) FROM doctors;
BEGIN;
INSERT INTO rate_limit_events(bucket,subject) VALUES ('migration_rehearsal','synthetic');
DELETE FROM rate_limit_events WHERE bucket='migration_rehearsal' AND subject='synthetic';
ROLLBACK;
RESET ROLE;
SQL

# Remove temporary policy identities before creating portable private-schema dump.
docker exec -i "$target_container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 > /dev/null <<SQL
DO \$wipe\$
DECLARE t record;
BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='clinic' LOOP
  EXECUTE format('DROP POLICY backend_access ON clinic.%I', t.tablename);
 END LOOP;
END
\$wipe\$;
DROP OWNED BY "$test_role";
SQL
docker exec "$target_container" pg_dump -U postgres -d "$test_db" --schema=clinic --format=custom --no-owner --no-acl > "$backup_dir/clinic-private-schema.dump"
sha256sum "$backup_dir/source.dump" "$backup_dir/clinic-private-schema.dump" > "$backup_dir/SHA256SUMS"
printf 'Rehearsal passed: all nine tables matched, private schema and restricted runtime role verified.\nProtected backups: %s\nLive backend unchanged; backups are rehearsal snapshots, not final cutover state.\n' "$backup_dir"
