# Patient email delivery through n8n

Date: 2026-10-14. Implementation deployed to Oracle; repository changes are
pending user review and commit. See ADR-004 for the decision and limitations.

## What each step does

1. The browser submits registration to the clinic backend. PostgreSQL stores the
   challenge with an HMAC hash, not a plaintext code. Existing limits and consent
   validation remain enforced.
2. The backend chooses EMAIL_DELIVERY=n8n and queues the rendered Arabic/English
   email. It posts recipient, subject and body to the production webhook with
   X-Clinic-Webhook-Key. Authentication/verification never moves into n8n.
3. The published Clinic Patient Emails workflow checks Header Auth, validates
   input, and calls Gmail through the existing SMTP account credential.
4. The SMTP node sends from noreplydeveloperportal@gmail.com. It returns a
   sanitized accepted/failure result, never the OTP or authentication header.
5. The patient reads their inbox and enters the code directly in the clinic
   form. The backend verifies it and returns a customer number; n8n delivers
   the account confirmation email.

## Server configuration

Deployment: /srv/team-projects/agentic-call-center.
Mode-600 .env.n8n holds EMAIL_DELIVERY, HTTPS webhook URL, webhook secret,
IDENTITY_ENABLED=true, ENVIRONMENT=production and separate generated service/OTP
secrets. Gmail's App Password lives only in the selected n8n SMTP credential.
Do not copy passwords or header secrets into workflow exports or source control.

Start with the existing database override plus all three protected env files:

```sh
docker compose --env-file .env.cutover-base --env-file .env.supabase --env-file .env.n8n -f docker-compose.yml -f docker-compose.supabase.yml --profile backend up -d --no-deps --force-recreate clinic-backend
```

Workflow id: rPolJrEZyYJRjvLV, owned by the existing personal project.
Production route: https://n8n.193-122-68-159.sslip.io/webhook/clinic-patient-email.
Authentication is Header Auth using credential Clinic Webhook Header.
The user-configured SMTP account credential was reused without exporting its
password. Workflow CLI publishing required a restart of the existing n8n container.

Local development defaults to SMTP/Mailpit. To use n8n elsewhere, provision a
separate authorized header credential and put its secret only in ignored config.
Do not change the shared webhook key casually: the backend and credential must
be updated together. Do not test real OTPs in n8n's manual editor.

## Review and verification

- 98 unit/PostgreSQL integration tests passed, including authenticated delivery,
  redirect protection, URL validation and production n8n configuration.
- Unauthenticated production webhook returned 403; authenticated email send
  returned 200 accepted. Invalid payload from the deployed backend returned 400.
- Workflow active state, Header Auth, empty pinned data and no-payload-save
  settings were verified from the stored workflow export.
- Oracle backend has identity enabled and N8NDelivery selected. Readiness and
  registration page returned 200. Supabase remains the clinic database.
- Full real-inbox registration completion requires the patient to enter their
  received code directly in the form; never send OTPs to the assistant/agent.
- The user completed that live Oracle test on 2026-10-14 and confirmed successful
  verification and receipt of a customer number. No code was sent to the agent.

For this developer review, an SSH tunnel forwards localhost:8002 to Oracle's
loopback port 8000. http://localhost:8002/register reaches the Oracle form while
the SSH process remains connected. It is not a public team URL. Other teammates
need their own authorized tunnel, or a separately configured HTTPS clinic ingress
with trusted proxy/rate-limit behavior. The existing api.sslip.io host serves
Supabase, not the clinic backend; do not overwrite that route.

## Rollback

The previous backend image is tagged clinic-backend:before-n8n-20261014;
source backup is /home/ziad/clinic-cutover/before-n8n-backend.tar.gz and workflow
backup is n8n-workflow-before.json in the same protected directory. To revert
delivery, explicitly select SMTP and configure its working credentials before
restarting the backend. Simply removing .env.n8n restores the previous disabled
identity settings; it does not provide functional SMTP registration. Supabase
data is unchanged by a delivery-provider rollback. Do not overwrite the existing
Supabase database rollback files/image with these provider rollback artifacts.
