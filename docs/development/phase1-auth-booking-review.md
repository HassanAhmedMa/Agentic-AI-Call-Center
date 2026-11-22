# Phase 1 Auth and booking implementation review

Status: deployed to Oracle on 2026-10-17 after explicit user approval.

## Responsibilities

- `supabase_auth.py`: validates browser access tokens against Supabase Auth, then checks identity/session claims. Tokens stay outside the agent context.
- `supabase_identity.py` and `supabase_routes.py`: associate verified Auth identities with clinic patients, preserve customer numbers, bind conversations, and support retryable logout.
- Registration HTML/CSS/JavaScript: Egyptian Arabic and English, Nile Clinics palette, email OTP signup/sign-in, editable profile validation recovery, memory-only access tokens.
- Migration 0005: nullable unique Supabase user association and Auth session association. Existing patients remain intact.
- `database/manual/04-supabase-auth-session-access.sql`: private boolean session check via a restricted projection of Auth session metadata. Runtime cannot read Auth tables or the projection directly; browser roles cannot execute the helper.
- `bookings.py` and `booking_routes.py`: patient-owned appointment listing/detail, transactional booking, rescheduling and cancellation, scheduling limits and change cutoffs.
- Migration 0006 and `idempotency.py`: patient/operation-scoped retry records with request hashes, replayed responses and expiry. Cleanup removes expired records.
- `deployment/supabase-auth.override.yml` and `supabase-otp.html`: direct Supabase Auth SMTP configuration and bilingual email template. SMTP credentials stay outside Git.

## Migration and deployment order

Before a paired rollout, back up the clinic schema and Supabase configuration. Review the private Auth-session helper against the installed Supabase version. Apply Alembic migrations 0005 and 0006 with the migration role, then provision the manual helper with an authorized database administrator. Configure the backend Supabase URL and public key, and confirm private schema grants. Never expose the clinic schema through PostgREST.

The email template URL in the override requires the backend to be reachable as `clinic-backend` on the Supabase Docker network. Verify that URL before enabling the Auth SMTP configuration. Set the sender credentials on the server; do not place passwords in this override. Keep the previous deployment and backup available. Downgrades are guarded when identity associations or live retry records would be lost.

Existing patients without a Supabase association must first use Create account with their existing email and verified identity; their clinic profile and customer number are preserved. Customer-number OTP login only sends to already linked identities.

## Review and remaining work

Review `/register` in Arabic and English and `/docs` for appointment routes. Integration tests use isolated schemas/databases on Docker PostgreSQL, outside OneDrive. Synthetic local Supabase Auth and Mailpit have exercised signup, profile completion and logout. Live Oracle/Gmail acceptance must follow the paired rollout.

Phase 1 still has support tickets and final acceptance remaining. Appointment idempotency keys now enforce the published contract: 8–128 alphanumeric/underscore/hyphen characters.

## Oracle deployment record (2026-10-17, Cairo)

- Pushed implementation `eeda21f` and contract fix `7f1b14b` on `docs/adr-003-identity-and-booking-rules`.
- Release directory: `/home/ziad/clinic-releases/eeda21f`; runtime code includes the `7f1b14b` fix. Active image `clinic-backend:auth-booking-final`, Compose project `clinic-auth-release`, container `clinic-auth-release-clinic-backend-1`.
- Protected backup: `/home/ziad/clinic-cutover/auth-eeda21f-20261016T215705Z`. `clinic.dump` retains the pre-migration schema. Deployment metadata and a paused-write snapshot are retained separately; these protected server files are not in Git.
- Previous container `agentic-call-center-clinic-backend-1` remains stopped for rollback. Neither its image nor any database volume was removed. Do not restore a stale database snapshot after new writes.
- Applied migrations through `0006_idempotency` with the migration role. Provisioned the manual Auth-session helper with `supabase_admin`, because this installation's `postgres` role cannot transfer ownership to `supabase_auth_admin`. Application runtime remains `clinic_runtime`, without superuser or BYPASSRLS.
- Supabase Auth retains v2.196.0 and direct Gmail SMTP. Applied only the Auth Compose override, using protected existing credentials. The clinic schema remains unexposed to the Data API.
- Normalized archive-extracted `pyproject.toml` and `alembic.ini` to 0644 on the server so the non-root image can read them. Protected environment files remain 0600.
- Verified readiness, bilingual catalog, Auth health, internal email-template reachability, and Gmail SMTP TLS authentication. The SMTP connectivity check sent no email.
- Live synthetic end-to-end verification passed: real Auth token/session, patient association/retry, booking/replay/list, reschedule, cancellation, and logout rejection. Synthetic deployment-test patient/Auth records and a cancelled appointment remain as test audit evidence. Existing patient data was not deleted.
- Real inbox delivery and browser OTP entry remain a user acceptance check. The backend listens on Oracle loopback port 8000; access it through an SSH tunnel until a public application hostname is configured.

Manage this backend with the release Compose file, rather than the team's older checkout:

```sh
docker compose -p clinic-auth-release -f /home/ziad/clinic-releases/eeda21f/deploy.compose.json ps
```

Application rollback requires stopping the new backend and restarting the retained prior container after considering new writes. Keep migrations and backups intact; no automatic downgrade or destructive restore was performed.
