# Patient portal authentication setup

Implementation is local and opt-in. The shared Oracle deployment is unchanged.
Serve the patient frontend through the backend at `/portal/auth.html` so browser
requests and HttpOnly cookies share one origin. Opening auth.html from disk or a
separate dev server does not establish this cookie session.

## Backend configuration

Use the existing Supabase identity and database configuration. Add:

```dotenv
PORTAL_ENABLED=true
PORTAL_ORIGIN=http://localhost:8004
PORTAL_COOKIE_SECURE=false
```

These HTTP settings are only for loopback development/test. Production requires
an HTTPS portal origin and `PORTAL_COOKIE_SECURE=true`. Configure one exact origin;
do not use wildcards. Keep database credentials, SMTP passwords, service keys and
ADMIN_API_TOKEN outside frontend files and Git. Existing OTP-only patient accounts
can use Forgot password to establish a password for this portal.

## Supabase Auth configuration (coordinate before applying)

Keep the current SMTP configuration. Ensure email signup is enabled and email
autoconfirm is disabled. Keep the current six-digit OTP configuration to match
this UI and backend SUPABASE_OTP_LENGTH=6. Set password minimum length to 12.
Keep the confirmation template numeric; configure recovery separately:

```yaml
# Merge into the existing auth service environment; preserve other settings.
GOTRUE_MAILER_AUTOCONFIRM: "false"
GOTRUE_PASSWORD_MIN_LENGTH: "12"
GOTRUE_MAILER_TEMPLATES_CONFIRMATION: http://clinic-backend:8000/identity-assets/supabase-otp.html
GOTRUE_MAILER_TEMPLATES_RECOVERY: http://clinic-backend:8000/identity-assets/supabase-recovery.html
```

Add the exact `<PORTAL_ORIGIN>/portal/auth.html` to the existing Auth redirect
allowlist (`GOTRUE_URI_ALLOW_LIST`), preserving teammates' existing entries. The
Auth container must resolve the clinic-backend network alias and fetch both
files with HTTP 200. Password recovery uses ConfirmationURL; signup uses Token.
The reset fragment is removed from browser history immediately and exchanged for
a 10-minute HttpOnly cookie. Password reset requires the same registered email,
a validated provider token and an active private Auth session. Passwords are sent
over HTTPS and managed only by Supabase Auth.

Supabase references:
- https://supabase.com/docs/guides/self-hosting/custom-email-templates
- https://supabase.com/docs/guides/auth/passwords

## Database migration and shared-server coordination

Inspect `sudo docker ps` and occupied ports before server actions. Back up the
clinic database and protected configuration. Apply 0008_unique_patient_phone
with the existing migration role and private clinic search path, after reviewing:

```sql
SELECT phone, count(*) FROM clinic.patients GROUP BY phone HAVING count(*) > 1;
```

Review duplicates privately. Migration intentionally aborts instead of deleting
or merging records. No automatic shared-server changes are part of this work.
Do not replace another team's container, port or Auth configuration. Agree on an
immutable image tag, planned cutover, allowlist/template settings and rollback.

## Acceptance checks

Use synthetic details and a controlled inbox. Signup with phone 01012345678,
confirm the email OTP and check the customer number. Logout, then test both
email/password and 01012345678/password login. Try another email with the same
phone, another phone with the same email, and a wrong password/OTP. Duplicates
must fail without extra clinic records. Test resend cooldown and expired OTP.

Request Forgot password, follow the delivered link, enter the same email and
matching new passwords, then sign in with the new password; the old password and
old sessions must fail. Test expired/reused links, forged #success, page reload,
logout, English/Egyptian Arabic and mobile layout. Inspect cookies for HttpOnly,
SameSite and production Secure. Do not copy secrets into screenshots or logs.

Dashboard appointment cards remain demo content and are explicitly labelled.
This change authenticates entry and profile/logout; it does not connect the
existing demo dashboard appointment actions to patient APIs.

Local PostgreSQL integration tests use an injected Auth provider. A live local
GoTrue/Mailpit acceptance run remains pending: automatic approval review rejected
the test-container startup command without a specific reason. This is separate
from unit/integration evidence and does not affect the shared server.


## Trusted reverse proxy and profile completion

For a backend published only on loopback behind Caddy, deploy Uvicorn with
`--proxy-headers --forwarded-allow-ips=<exact Docker host gateway IPs>` in place
of `--no-proxy-headers`. Determine the actual host gateways from the running
container networks. Never use `*`, trust arbitrary client headers, or expose the
backend port publicly. Caddy supplies the real source address. Without this
bounded trust, every public patient shares the proxy IP and can exhaust the
three-per-IP daily registration limit. Direct/untrusted connections must not be
able to spoof their source address with a header.

OTP verification and already verified profile repair have separate bounded
attempt counters. Invalid provider cookies still consume the OTP limit, so they
cannot bypass verification throttling. Profile errors retain Retry-After details.
Login redirects to the dashboard only after the backend has bound a clinic
profile; Auth login alone does not create that profile. An interrupted registration
may need its profile completed once after signing in. No patient data is invented
or written by an administrator to bypass verification.

Date of birth now uses a native calendar input, with typed ISO date validation,
a calendar button and age bounds. Returning-patient login navigates directly to
the dashboard after a successful server response. The dashboard data remains demo.

When a trusted source address changes, the portal starts a fresh conversation
while retaining the old conversation audit record. This also repairs cookies
created before proxy trust was configured, so they cannot keep applying a stale
proxy-wide registration quota. No rate-limit or patient rows are deleted.


## Google OAuth setup

Create a Google Cloud Web application OAuth client with basic openid/email/profile
scopes. Configure External audience and controlled test users during testing.
Google redirect URI is the **Supabase** origin plus `/auth/v1/callback`, not the
clinic frontend. Client secret belongs only in protected server Auth configuration;
it is unrelated to the Gmail SMTP app password. Do not commit either credential.

Add these values to the existing self-hosted **auth service** environment while
preserving SMTP, templates, database, SITE_URL and teammate settings:

```dotenv
GOTRUE_EXTERNAL_GOOGLE_ENABLED=true
GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=<web-client-id>
GOTRUE_EXTERNAL_GOOGLE_SECRET=<protected-client-secret>
GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI=https://<supabase-host>/auth/v1/callback
```

Append `<PORTAL_ORIGIN>/portal/auth.html?oauth_state=*` to GOTRUE_URI_ALLOW_LIST;
keep the original exact auth.html entry for password recovery. The wildcard is
limited to the state query on one exact HTTPS host/path, never a wildcard host.
Enable `PORTAL_GOOGLE_ENABLED=true` on the clinic backend. Add only the POST paths
`/api/v1/portal/google` and `/api/v1/portal/google/exchange` to the existing Caddy
patient matcher. Validate and back up the current file before a graceful reload;
never replace teammates' route blocks. Auth configuration takes an auth-service
recreation; coordinate the brief interruption and leave other services untouched.

Test existing patient Google login, first-time profile completion, duplicate
phone, canceled consent, invalid/missing callback state, replayed code and
English/Egyptian Arabic. Verify regular password login, signup OTP and recovery
still work. Use provider linking performed by Supabase; never merge clinic
identities based on browser-supplied email. Google-only accounts can establish a
password later with the existing Forgot password flow.

References: https://supabase.com/docs/guides/auth/social-login/auth-google and
https://supabase.com/docs/guides/auth/sessions/pkce-flow .

Disable backend URL access logging (`uvicorn --no-access-log`) for OAuth callback
queries; keep application error logs without credentials. The portal already
serves Referrer-Policy: no-referrer. Do not enable proxy access logs containing
full OAuth callback query strings.
