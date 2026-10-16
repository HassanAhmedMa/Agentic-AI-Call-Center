# Phase 1 Auth and booking implementation review

Status: local review snapshot, 2026-10-17. This commit does not deploy Oracle.

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

This snapshot is not a declaration that Phase 1 is complete: support tickets and final acceptance remain. The appointment idempotency implementation currently accepts 1–128 printable ASCII characters; the existing published contract specifies 8–128 alphanumeric/underscore/hyphen characters. Reconcile that boundary before rollout.
