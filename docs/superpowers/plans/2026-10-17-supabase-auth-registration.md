# Supabase Auth Registration Implementation Plan

> For agentic workers: use superpowers:executing-plans to implement this plan task by task in this chat. No independent implementation workers are requested. A fresh final code review is required.

**Goal:** A Nile Clinics styled bilingual registration form verifies Supabase OTPs and transactionally links verified users to private clinic patient records.

**Architecture:** Supabase Auth sends OTPs directly through the already configured Gmail SMTP and owns authentication sessions. FastAPI validates verified identity and enforces clinic profile, ownership, conversation and booking boundaries. Keep frontend Auth tokens in memory; keep the clinic schema private.

**Tech stack:** Existing Python/FastAPI/SQLAlchemy/Alembic/PostgreSQL stack, bounded HTTPS Auth REST calls, plain JavaScript/CSS, existing self-hosted GoTrue v2.196.0. Avoid a new frontend framework or authentication dependency unless required and verified.

**Spec:** ../specs/2026-10-16-supabase-auth-n8n-design.md, revised and approved for direct SMTP on 2026-10-17. Its historical filename does not imply an n8n OTP dependency.

## Global constraints

- Same branch: docs/adr-003-identity-and-booking-rules. Preserve unrelated edits.
- No new standalone PostgreSQL container on Oracle; use existing Supabase.
- Preserve patients, IDs, customer numbers, appointments and private-schema access.
- Supabase alone generates/verifies OTPs in Auth mode; Gmail delivers directly.
- No OTP, Auth token, App Password or privileged key in logs, Git or model context.
- Retain the existing conversation authorization boundary for agent calls.
- Keep Arabic/English, RTL/LTR, consent, accessibility and mobile support.
- Use UI-branch brand tokens without merging its unrelated backend/admin changes.
- No automatic commits or Oracle application deployment before user review.
- User participates only in live inbox testing by entering the OTP in the form.

## Review focus

1. A verified new Auth user must not claim an already-linked clinic patient.
2. Concurrent registration/retry must preserve exactly one patient/customer number.
3. A revoked Auth session must not authorize clinic actions through a surviving binding.
4. Wrong API URL/key, HTML provider errors and missing Auth configuration must fail clearly without leaking credentials.
5. Longer OTPs, Arabic digit entry and expired sessions must not strand the bilingual form.

## File map

- Backend: new supabase_auth.py (bounded Auth transport), supabase_identity.py
  (clinic linking/bindings), supabase_routes.py (HTTP boundary).
- Shared DTOs: new clinic_schemas/supabase_identity.py; reuse Registration validation.
- Persistence: new frozen 0005_supabase_identity.py; extend identity_models.py;
  optional restricted Auth-session helper provisioning SQL separate from migrations.
- Settings/app: explicit identity_provider=clinic|supabase, public Auth configuration,
  conditional router mounting, unchanged catalog/conversation routes.
- Existing register.html/register.js/register.css: Auth state machine and palette.
- Server templates/override: versioned bilingual Auth OTP template and minimal
  Supabase Auth override; protected credentials remain server-only.
- Tests: Auth transport unit tests, private-schema linking/session integration tests,
  frontend contract tests and browser/manual live acceptance notes.

### Task 1: Provider contract and bounded Auth transport

Interfaces: VerifiedAuthUser(user_id: UUID, email: str, session_id: UUID,
email_verified_at: datetime); AuthClient.verify_access_token(token: str) ->
VerifiedAuthUser; AuthClient.send_existing_otp(email: str) -> None;
AuthClient.logout(token: str) -> None. Calls are async, injectable in tests,
with a 10-second timeout, no redirects, bounded token/body sizes and sanitized errors.

- [ ] Read the installed GoTrue configuration/source docs to pin actual public URL,
  issuer, OTP length, expiry and /user, /otp, /verify, /logout response contracts.
  Use no secret output or test emails in this discovery step.
- [ ] Add failing unit tests in tests/unit/test_supabase_auth.py: valid verified
  user accepted; expired/rejected token, missing email confirmation, wrong user,
  missing/invalid session UUID, oversized/malformed/HTML responses and redirects
  rejected; provider 429/5xx become sanitized application errors.
- [ ] Run the focused tests and observe failure before implementing the client.
- [ ] Implement supabase_auth.py and settings. Verify tokens authoritatively with
  this deployment's /user endpoint before reading any token claims. Validate the
  returned identity against the validated token; never trust unverified JWT decode.
  Enforce configured issuer/audience/expiry and require a non-anonymous email user.
- [ ] Validate production HTTPS URLs without credentials/query/fragment; permit
  loopback HTTP only for test mode. Expose only the URL, public key and OTP format
  via GET /api/v1/auth/config. Missing configuration fails closed.
- [ ] Re-run unit/settings tests, Ruff and strict mypy.

### Task 2: Additive patient association and active-session checks

Files: database/migrations/versions/0005_supabase_identity.py, identity_models.py,
database/manual/04-supabase-auth-session-access.sql,
tests/integration/test_supabase_identity_schema.py.

Interfaces: Patient.supabase_user_id: UUID | None (unique);
PatientSession.supabase_session_id: UUID | None. A private boolean session-check
function accepts verified user/session UUIDs and checks auth.sessions ownership
and expiry. Browser roles receive no execute/schema access.

- [ ] Write failing migration tests: fresh upgrade and 0004 upgrade preserve
  existing rows/numbers; duplicate Auth associations fail; existing legacy rows
  remain valid; non-owner clinic runtime can use new fields.
- [ ] Write failing session-check tests using an isolated database: active matching
  session true, revoked/missing/wrong-owner/expired false; runtime cannot read auth
  tables; anon/authenticated cannot call the helper or read clinic data.
- [ ] Implement additive nullable columns/index and safe downgrade (reject removal
  when populated associations would be lost). Do not create auth tables in the
  live Supabase cluster. Keep legacy challenge/history data intact.
- [ ] Provision the private helper only through explicit admin SQL with a fixed
  search_path and qualified names. If SECURITY DEFINER is required, use a dedicated
  NOLOGIN, non-superuser owner with only required read privileges; revoke PUBLIC
  execution and grant only clinic_runtime. Inspect auth.sessions RLS first; do
  not change managed Auth policies or grant runtime general Auth-table access.
- [ ] Re-run schema, upgrade and privilege tests. Keep Oracle unchanged.

### Task 3: Transactional profile completion and conversation bindings

Interfaces: SupabaseIdentity.complete(conversation, verified_user, Registration)
-> PatientProfile; bind(conversation, verified_user) -> PatientProfile;
is_live_binding(binding) -> bool. Preserve existing profile/logout API envelopes.

- [ ] Write failing integration tests in tests/integration/test_supabase_identity.py:
  new registration creates one patient and customer number; retry/concurrent calls
  keep one row/number; verified existing email links the existing patient without
  overwriting profile; association conflicts fail; malformed profile/false consent
  fail; unverified or revoked Auth users cannot complete or bind.
- [ ] Test account switching, foreign conversations, expired/disconnected/ended
  conversations, local session timeout, provider logout and external Auth-session
  deletion. A stale binding must not authorize another sensitive action.
- [ ] Implement unique-constraint backed linking inside a transaction, with bounded
  retry for customer-number collision and association races. Reuse existing Luhn
  generation, conversation validation, binding revocation and permitted profile DTO.
  Derive email/user identity from Auth verification, not request metadata.
- [ ] Add POST /api/v1/auth/complete with Bearer Auth + X-Conversation-Token and
  existing Registration fields. Add POST /api/v1/auth/bind for verified returning
  users. Never return internal patient/Auth IDs or raw tokens to an agent.
- [ ] Preserve customer-number login through an explicitly rate-limited backend
  adapter using existing-user-only Supabase OTP initiation and generic outcomes.
  It must not disclose the resolved email or create Auth users for unknown logins.
- [ ] On cutover invalidate pending legacy challenges and revoke legacy bindings;
  require reauthentication. Do not delete records or run two OTP providers together.
- [ ] Re-run identity/conversation tests, including legacy mode compatibility.

### Task 4: Registration form integration and Nile Clinics design

Files: existing static/register.html, register.js, register.css; app.py CSP/router
mounting; tests/unit/test_registration_supabase.py; browser review notes.

Interfaces: browser Auth POST /otp with signup enabled for registration, POST
/verify with type=email, then backend POST /auth/complete. Config comes from
/api/v1/auth/config. Tokens/form contents stay in memory, not localStorage or URLs.

- [ ] Add failing frontend contract tests for mode/config selection, variable OTP
  length, expired/incorrect codes, resend cooldown, provider failure and successful
  backend completion. Include Arabic digits normalized to ASCII before submission,
  RTL/LTR switching and clearing sensitive state on logout/session failure.
- [ ] Implement direct Supabase Auth calls with the public API key only, correct
  status/error handling and no silent legacy OTP fallback. Keep pending profile
  fields in memory until verification; never put phone/DOB in Auth user_metadata.
  Return to a usable form on reload or session expiry; avoid duplicate submissions.
- [ ] Keep current backend-served page and extend connect-src only for the exact
  validated Supabase origin. Preserve frame/form/referrer security headers.
- [ ] Apply UI-branch tokens: primary #2563EB, hover #1D4ED8, subtle #EFF6FF,
  page #F8FAFC, card #FFFFFF, text #0F172A/#334155/#64748B, border #E2E8F0.
  Match Nile Clinics branding, existing Inter/Cairo font stacks and focus/status
  styling without adding external fonts or importing unrelated UI/backend code.
- [ ] Browser-check desktop/mobile Arabic and English registration, OTP, error and
  success states. Confirm no clipped fields, correct direction and keyboard focus.

### Task 5: Supabase templates, packaging and deployment preparation

Files: templates/supabase/confirmation.html, deployment/supabase-auth.override.yml,
scripts/smoke_supabase_identity.py, .env.example, Docker/CI settings, updated
ADR/API/database/identity/development documentation.

- [ ] Test the bilingual template contains the actual GoTrue .Token variable,
  supports typed OTP and contains no clinic profile data or magic-link dependency.
  Verify installed GoTrue template URL/path support before selecting its mount.
- [ ] Package the template/configuration without passwords or private keys. Keep
  confirmation required and SMTP credentials in the existing protected .env.
  Do not enable Send Email Hook or change unrelated n8n services.
- [ ] Make the standalone registration backend runnable locally against a dedicated
  test database with synthetic records. Do not point development tests at live
  clinic records or silently recreate the removed database service on Oracle.
- [ ] Add failure/success smoke checks that send no live email automatically. Update
  contracts for provider error/cooldown semantics and mark legacy OTP behavior as
  superseded in Supabase mode. Keep agent ownership rules explicit.
- [ ] Prepare an exact paired image/schema/template rollout and rollback script:
  backup current config/schema/image; restore reviewed backend code; apply additive
  migration/helper; switch Auth mode; verify readiness/permissions before admission.
  No Oracle deployment at this task stage.

### Task 6: Final verification and user review

- [ ] Run all unit and real isolated-PostgreSQL integration tests. Re-run Ruff,
  Black, strict mypy, repository validation, Compose syntax and git diff --check.
- [ ] Build Docker image and smoke migration, public catalog/availability and new
  Auth config/profile routes. Verify invalid tokens fail without provider secrets.
- [ ] Obtain one fresh full-change code review; fix critical/important findings and
  re-run affected checks. Do not dispatch independent implementation agents.
- [ ] Present the local styled form, changed-file responsibilities and precise
  verification evidence. Keep code uncommitted for user review.
- [ ] After the user's deployment decision, execute the recorded paired cutover.
  A live test then requires the user to enter the emailed OTP directly in the form;
  verify patient creation/linking and stable customer number without reading OTPs.
