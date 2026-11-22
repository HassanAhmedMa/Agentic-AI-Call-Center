# ADR-004: n8n delivery for clinic transactional emails

Status: Accepted by the user for this implementation on 2026-10-14.
No broader teammate or supervisor approval is implied.

## Decision

Use the existing self-hosted n8n instance to deliver clinic verification,
account-number and duplicate-registration notice emails. The user selected n8n
for visual workflow configuration and approved connecting the reviewed workflow.
Retain direct SMTP as the default local adapter. No new Python dependency is added.

The backend generates and verifies OTPs, enforces expiry/rate limits and owns
patient bindings. Its n8n adapter sends only recipient, subject and body through
an authenticated HTTPS webhook. n8n uses the user-configured SMTP credential and
fixed sender noreplydeveloperportal@gmail.com. It has no patient database access.

## Interface and safeguards

- POST /webhook/clinic-patient-email on the configured n8n host.
- Header X-Clinic-Webhook-Key contains an independent generated secret.
- Payload has exactly recipient, subject and body string fields; plain text
  supports Egyptian Arabic and English. Invalid payload returns 400.
- Gmail SMTP acceptance returns 200 with exactly status accepted. SMTP failure
  returns 502. Acceptance is not confirmation of arrival in the recipient inbox.
- Backend rejects redirects and unexpected responses, uses a twenty-second
  request timeout, and logs only generic delivery failure without payload/secrets.
- Webhook requests use HTTPS; HTTP is permitted only for loopback unit tests in
  the explicit test environment. URL credentials, query and fragment are rejected.
- Successful/failed/manual execution payload saving and progress saving are off;
  no actual patient/OTP data is pinned. n8n credentials are encrypted by n8n.
- No automatic retry/fallback to SMTP: unknown delivery outcomes could duplicate
  email. Patient resends continue through backend cooldowns and limits.

## Consequences

Workflow settings and credentials can be reviewed in n8n. SMTP and n8n failures
remain asynchronous to avoid account-enumeration timing. The existing bounded
backend queue remains volatile; a restart can lose queued delivery. A durable
encrypted outbox and operator alerts remain future production work. Provider
availability and limits remain external dependencies. Changing delivery provider
does not change the API's generic challenge responses or authorize new agent tools.
