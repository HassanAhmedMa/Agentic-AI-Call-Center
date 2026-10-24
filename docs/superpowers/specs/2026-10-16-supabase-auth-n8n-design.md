# Supabase Auth OTP, direct SMTP and Nile Clinics registration

Updated: 2026-10-17. Status: revised design approved by the user for commit.
SMTP infrastructure is deployed; registration integration is not yet implemented.
The implementation plan remains the next step.

## Approved intent

The user selected Supabase Auth to generate and verify OTPs. Supabase Auth sends authentication emails directly through Gmail SMTP; n8n is not part of OTP delivery. The separate application PostgreSQL container has been
removed; the self-hosted Supabase database is the shared clinic database.
Keep English and Egyptian Arabic support, existing clinic records and customer
numbers. Do not grant the browser direct access to private clinic tables.

## Initial inspection before the SMTP update (2026-10-16)

- Supabase database 17.6 is healthy on the private supabase_default network.
  The private clinic schema contains all thirteen tables, including Alembic
  revision 0004_scheduling. clinic_runtime and clinic_migrator are non-superuser,
  non-BYPASSRLS roles. No new database container is required.
- GoTrue v2.196.0 is healthy. Email signup is enabled and autoconfirm is false.
  Send Email Hook settings are commented out in the source Compose file and
  absent from the live container. SMTP points to supabase-mail:2500, with
  admin@example.com as the configured sender. No such SMTP container was found.
- SITE_URL is http://localhost:3000; redirect allowlist is empty. The configured
  external Auth URL includes /auth/v1. Generated URL behavior must be checked
  against the installed GoTrue release before changing it.
- PostgREST exposes public,graphql_public. clinic is not exposed. Envoy listens
  on server loopback 8001; Supavisor uses loopback 5433/6544. Database port 5432
  is not published by the Supabase database container.
- Edge runtime v1.76.2 contains main and hello functions. Global function JWT
  verification is disabled: any Auth hook endpoint must authenticate its own
  signed requests. Do not assume gateway JWT verification protects it.
- n8n 2.42.7 workflow rPolJrEZyYJRjvLV is active, uses Header Auth and an SMTP
  credential, has no pinned data and disables execution payload retention.
  n8n is not on the Supabase Docker network; its existing HTTPS route is available.
- The clinic backend was recreated after the availability deployment. Its live
  image lacks database_schema/email_delivery settings, identity_enabled is false,
  and /register returns 404. Restore a reviewed application image/configuration
  during application cutover; configuring SMTP alone cannot restore the form.

Inspection used read-only configuration/database metadata and redacted settings.
No credentials, patient rows, OTPs or execution payloads are part of this spec.

## Selected approach

The user selected Supabase Auth with direct Gmail SMTP, rather than the earlier
Auth-hook/n8n design. GoTrue generates/verifies OTPs and handles authentication
sessions. Gmail delivers emails using the protected server App Password.

On 2026-10-16 Gmail STARTTLS authentication passed. The protected Supabase .env
was backed up and updated; only supabase-auth was recreated. Live settings use
smtp.gmail.com:587 and noreplydeveloperportal@gmail.com. Autoconfirm is false,
the Send Email Hook is disabled, Auth is healthy and the public Auth health
route returned 200 with the configured public API key. No test email was sent.
No Gmail secret was printed or added to the repository.

The flow is form -> Supabase Auth -> Gmail SMTP -> inbox. The form sends the
entered code to Supabase Auth, then calls the clinic backend to link or create
the verified patient's clinic record. n8n remains available for unrelated work;
its workflow and credentials are preserved. Do not create an Edge hook adapter,
new email webhook, or another PostgreSQL container.

## Frontend appearance

The complete frontend exists on origin/UI at commit f82df93, not on the current
docs/adr-003-identity-and-booking-rules checkout. Reuse its user-facing design
tokens from frontend/user/styles.css; the admin theme confirms the same brand.
Do not merge its unrelated backend/admin changes into this increment.

- Primary #2563EB; hover #1D4ED8; subtle #EFF6FF; primary border #BFDBFE.
- Page #F8FAFC; cards #FFFFFF; main text #0F172A; body #334155;
  muted #64748B; neutral borders #E2E8F0.
- Preserve semantic success/error colors and visible keyboard focus.
- Use the frontend's Inter/Cairo font stacks with local/system fallbacks.
  Do not silently add external font requests or weaken the page's CSP.
- Keep Arabic/English switching, RTL/LTR, mobile layout and accessible field,
  validation, OTP and success states. Display Nile Clinics branding.

Update the existing backend-served register.html/register.css/register.js rather
than duplicating the frontend app. Copy only the required design tokens; retain
this branch and its current backend contracts except the explicit Auth migration.

## Registration and login flow

1. The bilingual form collects the required clinic profile and consent. OTP
   initiation uses Supabase Auth; Supabase owns token generation, expiry,
   verification and Auth sessions. No custom backend OTP is generated in this
   mode. New Auth accounts alone do not create clinic patient records.
2. Supabase Auth renders the OTP email template and sends it using Gmail SMTP.
   Use the explicit .Token variable so the email contains a typed code rather
   than relying on a magic-link redirect. Supabase reports SMTP failure and
   applies configured resend/rate limits. No request goes through n8n.
3. The patient types the OTP into the form. The browser verifies it with Supabase
   Auth and receives its session. OTPs and Auth tokens never enter model context,
   analytics, application logs or workflow execution history.
4. A verified browser calls a backend profile-completion endpoint with its Auth
   access token and validated clinic fields. The backend checks the current
   verified Auth user, derives identity/email from that verified result and
   transactionally creates or links the clinic patient. Client-submitted Auth
   IDs, email_verified flags and customer numbers are never trusted.
5. Return the existing/generated customer number and permitted profile fields.
   Repeated completion is idempotent and does not create a second patient.
6. Returning users use Supabase email OTP. Preserve customer-number login through
   a backend compatibility adapter that resolves the number privately and asks
   Supabase to send an existing-user OTP. It must not expose the resolved email
   or create new users for login. Generic outcomes and existing anti-abuse rules
   remain necessary. Customer numbers remain stable patient-facing identifiers.

The backend remains the authority for clinic profile validation, customer numbers,
patient ownership, booking rules and transactions. Supabase Auth is the authority
for verified email identity and authentication sessions.

## Patient migration and sessions

Add a nullable unique Supabase Auth user UUID association to clinic.patients via
a new frozen Alembic migration. Preserve every existing patient ID, number,
profile and appointment. Existing patients link lazily after a successful Auth
verification of their existing verified email. A transaction and uniqueness
constraints prevent concurrent completion/linking from producing duplicates.
Do not overwrite an established user association or merge identities based on
unverified client metadata. Conflicts require an explicit account recovery path.

Keep the existing conversation-scoped patient binding for service/agent calls;
it is an authorization boundary, not another OTP provider. Browser Auth sessions
must be verified before binding. No raw Supabase token is exposed to the agent.
Ending a conversation revokes its binding, while browser logout revokes the
appropriate clinic bindings and Supabase session. Sensitive actions must check
that the referenced Supabase Auth session remains active, not merely that an
unexpired JWT has a valid signature. If a private database session-check helper
is needed, return only a boolean for validated user/session IDs; grant execution
only to the backend runtime role and no browser role. Do not grant general
runtime access to auth tables or alter Supabase-managed table definitions.

Pending legacy challenges are invalidated at cutover. Legacy bindings are revoked
and users reauthenticate. Retain legacy tables/data for rollback and audit;
remove old OTP endpoints from the active Auth mode rather than running two
verification authorities. Historical OTP/session behavior remains documented as
superseded, with an ADR recording this change to the existing identity contract.

## Email and browser security

Configure Supabase email templates for a typed OTP using documented GoTrue
variables and the installed version's template configuration. Provide Arabic and
English in one bilingual template initially; this guarantees both languages
without depending on unverified metadata/template-language conditionals. Include
no phone, date of birth, medical information or customer profile in OTP email.
Escape all user-supplied metadata. Keep SMTP credentials in protected server
configuration only, with backup/rollback instructions. Do not log codes/tokens.

Use Supabase's OTP API and verification API; do not keep the old clinic OTP
endpoint active as an alternate verification authority in this mode. The frontend
must handle actual provider expiry/attempt/resend responses without promising
legacy limits that GoTrue does not enforce. Derive the input's code length from
the deployed OTP configuration rather than assuming the previous six-digit limit.
Keep Auth tokens in memory where possible, out of URLs, logs and model context;
any persisted sessions must follow an explicitly documented secure lifecycle.

Post-verification customer-number notification is separate from OTP delivery.
Display the number in the verified form first. Do not assume configuring Auth
SMTP makes the backend's previous n8n notification adapter functional; preserve
existing working notifications only where independently configured and tested.

## Configuration and frontend

Add an explicit Supabase Auth mode and validated private/public URLs to backend
settings. Public frontend configuration includes only the Supabase API URL and
publishable/anon key. Service-role, database and SMTP secrets remain private.
Never print expanded Compose output or credential values during deployment.

Retain the existing protected SMTP configuration and template paths through a
small version-controlled Auth Compose override. Preserve unrelated Supabase
services. Configure the development origin for local review, with exact redirect
allowlists only if the chosen session flow needs them. A shared public website
address is not required for typed OTP local testing. Maintain the backend page's
CSP, extending connect-src only to the exact approved Supabase origin. Public
catalog/clinic calls use the backend's own origin; no wildcard CORS is added.

Keep clinic outside PostgREST's exposed schemas. Public catalog/availability and
authenticated clinic operations continue through FastAPI. Update Swagger/API,
database/tool contracts, identity documentation, team setup and deployment notes.

## Verification and cutover acceptance

Rehearse on an isolated database/Auth environment with synthetic data. Test valid,
expired and incorrect OTPs; repeated profile completion; existing-patient linking;
concurrent linking; identity/association conflicts; consent and field validation;
conversation ownership/end/logout/session revocation; Arabic/English templates;
SMTP rejection/timeouts; missing or incorrect public API configuration; and absence of sensitive data in responses/logs/workflow retention.
Retain catalog/availability regression coverage and private-schema permissions.

Before deployment, preserve the active image/configuration, schema backup and Auth templates. Record exact versions/revisions and existing table fingerprints. Apply
an additive clinic migration, deploy paired application/Auth configuration, then
verify readiness, public-key routing and provider errors before a synthetic live-inbox
registration. The user enters the OTP directly in the form. Confirm exactly one
patient with the expected customer number and successful returning-user login.

Do not seed Supabase Auth users, bulk-send emails, delete old patient data, restart
unrelated services or recreate the removed standalone PostgreSQL container.
Rollback requires the reviewed pre-change image/configuration and preservation of
new Auth associations/writes. Do not blindly restore an older database snapshot.
Supabase Auth/application changes must have recorded rollback instructions before cutover.

## Required review outcomes

One successful local synthetic registration must receive an actual Supabase OTP,
verify it with GoTrue, create/link exactly one clinic patient and display its
customer number. A repeat must preserve that number. Existing patients must
retain their records. Review the styled form at desktop and mobile widths in
both languages, and verify keyboard/error/success states. Do not commit or
redeploy the application increment until the user reviews the result.
