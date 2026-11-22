# Oracle Supabase migration preparation

Date: 2026-10-13. Cutover completed on Oracle. Do not commit backup dumps or credentials.

## Verified environment

- SSH user ziad can operate Docker.
- Backend deployment: /srv/team-projects/agentic-call-center.
- Supabase deployment: /srv/supabase; network supabase_default.
- Source agentic_clinic_postgres: PostgreSQL 16.15, clinic_db, public schema,
  Alembic 0003_identity. Counts: five specialties, ten doctors, fifteen services,
  zero patients/conversations/patient sessions/challenges at inspection.
- Target supabase-db: PostgreSQL 17.6, database postgres. No clinic schema at
  rehearsal. Supabase Auth/Storage remain untouched.

## Rehearsal and backups

scripts/prepare_supabase_migration.sh executed successfully on Oracle.
It takes a custom-format source dump, restores into an isolated temporary
database, compares row counts and deterministic content digests for all nine
tables, renames the schema through PostgreSQL rather than altering data strings,
and tests a restricted non-owner role with RLS. Temporary database/role are
removed. It leaves mode-restricted backups and SHA256SUMS on the server.

Successful snapshot directory:
/home/ziad/clinic-migration-backups/20261013T201107Z_3742806

The production ownership/grants SQL was additionally rehearsed using temporary
role names and an isolated database. Enum/table/sequence ownership, RLS policies,
runtime catalog reads and transactional rate-limit insert/delete passed. All
temporary roles/databases were removed. The application suite passed 91 tests;
Ruff, Black, strict mypy, repository validation and whitespace checks passed.

These are rehearsal snapshots, not authoritative final copies after new writes.
source.dump restores to the old layout; clinic-private-schema.dump restores to
the private clinic layout. Both preserve existing sequence positions and
Alembic history. Do not run database/manual/01 or 02 to migrate existing data;
those are a separate fresh-install option and would not copy patient/session data.

## Prepared application changes

DATABASE_SCHEMA defaults to public for local/current deployment. When clinic is
selected, runtime, Alembic and seed connections use clinic, pg_catalog search_path.
Schema identifiers are validated. docker-compose.supabase.yml joins the backend
to the existing Supabase Docker network and uses a protected server connection URL.
The original database dependency/container is retained for rollback.

The plugin's unrelated hosted account is not used. No Supabase Auth rewrite or
public Data API clinic access is introduced. Keep clinic absent from exposed
PostgREST schemas. Runtime policies trust only clinic_runtime; the backend
continues to enforce identity, ownership and business rules. Runtime cannot run
DDL or write Alembic history; clinic_migrator owns clinic objects.

## Cutover sequence for review

1. Deploy/build the reviewed backend version with DATABASE_SCHEMA support while
   still pointing to the original database. Confirm readiness and catalog.
   Record the image id and protect copies of the active server Compose/env files.
2. Pause backend writes by stopping only clinic-backend; preserve n8n and all
   Supabase services. Pause any other source writers. Run the rehearsal script
   again to obtain an authoritative snapshot. If any step fails, restart the old
   backend and stop the cutover.
3. Recheck that target postgres has no clinic schema. Provision clinic_migrator
   and clinic_runtime as LOGIN NOSUPERUSER NOBYPASSRLS roles, with separate random
   credentials stored only in protected server configuration. Give postgres
   membership in clinic_migrator for ownership transfer. Never log passwords.
4. Restore the new clinic-private-schema.dump with pg_restore --exit-on-error
   --single-transaction --no-owner --no-acl into supabase-db's postgres database.
   Run database/manual/03-supabase-runtime-access.sql. Validate source/target
   counts and contents, revision, sequences, RLS and denial for anon/authenticated.
   Test these grants in the isolated rehearsal before live execution.
5. Keep the usual .env and add a mode-600 .env.supabase containing
   CLINIC_SUPABASE_DATABASE_URL with clinic_runtime credentials, host supabase-db,
   port 5432, database postgres, postgresql+asyncpg scheme. It must not contain
   migration credentials. Never print docker compose config with secrets expanded.
6. Start only clinic-backend using both Compose files and both env files:

   docker compose --env-file .env --env-file .env.supabase -f docker-compose.yml -f docker-compose.supabase.yml --profile backend up -d --no-deps --force-recreate clinic-backend

7. Check readiness, Arabic/English catalog, registration, OTP, profile/logout,
   reconnect and cleanup. Confirm the server SMTP configuration independently
   of the developer laptop. Keep admission closed until initial checks pass.
8. Record verified cutover time, active image and protected backup location.
   Open admission. Keep the source stopped for writes and its volume intact.

## Rollback

Before reopening writes, stop the replacement backend, start the retained source
database with `docker compose --env-file .env.cutover-base up -d database`, and recreate clinic-backend
using the original Compose/env files only. Its default public schema and original
source database are unchanged. Confirm readiness/catalog before reopening.

After any writes to Supabase, returning to the old snapshot loses new operations.
Keep admission closed, preserve a fresh target dump, reconcile/copy new data back
and verify it before rollback. Never silently switch back to stale data. Do not
drop the source volume, target schema or Supabase services as rollback shortcuts.

## Actual cutover record

- User authorized execution on 2026-10-13. Final paused-write backup:
  /home/ziad/clinic-migration-backups/20261013T201945Z_3769591.
- Existing container settings recovered into protected .env.cutover-base;
  original server checkout had no .env. Use .env.cutover-base instead of .env
  in the above server commands. Runtime credentials are in .env.supabase;
  migration credentials are separately in /home/ziad/clinic-cutover/migration.env.
- Original image is tagged clinic-backend:before-supabase-20261013. Protected
  original container metadata/workspace are under /home/ziad/clinic-cutover.
  docker-compose.rollback.yml is server-only and selects that saved image.
- Target clinic schema restored, dedicated roles provisioned and ownership/access
  SQL applied. All nine live table counts/content digests match the source.
  All clinic tables have RLS; anon/authenticated lack schema usage.
- Deployed image reads database postgres as clinic_runtime, search_path clinic.
  Readiness and English/Arabic doctor search, specialty/service endpoints passed.
- Non-root readiness exposed unreadable migration files after Windows transfer.
  Dockerfile now explicitly makes bundled migrations/seeds readable to the app.
- Existing server settings have IDENTITY_ENABLED=false and SMTP_USE_TLS=false.
  These were preserved. Server OTP is not configured or verified by the cutover;
  the working developer-laptop Gmail configuration remains independent.
- Supabase Auth/Storage and n8n were not changed. Local development still uses
  PostgreSQL/public. Source database container is stopped and its volume retained
  for rollback. The Supabase Compose override removes the old dependency so it
  does not restart the source when deploying only clinic-backend.
- Repository changes remain uncommitted pending user review.
