# Clinic Patient Emails — review draft

Import clinic-patient-emails.json using the workflow editor's menu, Import from
File. The workflow is inactive and contains no passwords or real patient data.
Credential placeholders must be selected/replaced in the editor before use.

Flow: authenticated POST webhook -> request validation -> Send Patient Email ->
sanitized response. Invalid payloads return 400; SMTP failures return 502; SMTP
acceptance returns 200 with status accepted. Acceptance is not an inbox receipt.

## Credentials to configure after review

- Patient Email Webhook: Header Auth credential named Clinic Webhook Header,
  header name X-Clinic-Webhook-Key, independently generated secret of at least
  32 random bytes. Store the matching secret only in the backend configuration.
- Send Patient Email: SMTP credential named Clinic Gmail SMTP; host smtp.gmail.com,
  port 587, user noreplydeveloperportal@gmail.com, password Google App Password. Implicit
  SSL/TLS is off for port 587; STARTTLS must remain enabled, with certificate
  verification on. No password belongs in exported workflow JSON.

After publishing, the intended production endpoint is:
https://n8n.193-122-68-159.sslip.io/webhook/clinic-patient-email

The Oracle workflow based on this template is now published and connected.
See docs/development/n8n-email-setup.md for the verified deployment.
The test endpoint uses /webhook-test/ and requires Listen for test event.

## Backend payload contract

Authenticated server-to-server JSON has exactly recipient, subject and body
string fields. The backend composes Arabic/English text and owns all OTP
generation, hashes, expiry, verification and rate limits. n8n never reads patient
tables or decides whether a patient is verified. Sender is fixed in the workflow.

## Review and privacy

Successful/failed/manual execution payload saving and execution progress saving
are disabled in this draft. No data is pinned. Manual preview can still display
incoming data transiently: use synthetic messages when reviewing. Do not enable
payload retention or pin actual OTP/email input. No automatic retries are enabled;
retrying an unknown SMTP outcome can produce duplicate emails. A patient resend
must remain a backend operation governed by existing cooldowns.

JSON shape, node connections and input validation were checked locally, and
Webhook/SMTP/response node fields were checked against installed n8n 2.42.7.
This portable template stays inactive with credential placeholders. The existing
Oracle workflow is separately configured; do not overwrite its credentials by
reimporting this template.
