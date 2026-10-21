# Phase 1 patient identity implementation

User authorized implementing the previously specified next milestone, then human
review before commit. Existing API §4 and §6.1, database identity tables and
ADR-003 define the design. Execute inline with one independent final review.

## Scope and sequence

1. Write failing tests for registration validation, Luhn identifiers and real
   PostgreSQL registration/verification/session lifecycle.
2. Add frozen migration 0003: patients, verification challenges, patient sessions.
3. Add SMTP adapter (stdlib), bounded asynchronous delivery and bilingual mails.
   Local Mailpit captures emails; actual delivery requires configured SMTP.
4. Implement registration, service-only login challenge, browser-only code
   verification, verification polling, minimal patient profile and logout.
5. Enforce atomic per-email/customer/IP/conversation rate limits and concurrent
   email uniqueness; clear code/form material on terminal states.
6. Revoke bindings on conversation end/expiry; enforce idle/absolute timeout;
   schedule retention cleanup and retain historical session metadata.
7. Add static English/Egyptian Arabic registration/code page. No service token
   enters browser code; service-only login/profile/logout remain operator/agent
   APIs until the agent exists. No insecure browser login proxy is invented.
8. Verify tests, lint, types, Docker migration and actual Mailpit delivery/UI;
   update contracts/status/docs, leave uncommitted for review.

## Decisions

- Stdlib email parser and SMTP transport behind an injectable delivery interface.
  Added pinned tzdata for Windows IANA/Africa/Cairo support, consistent with the
  existing Python stack/date contract. SMTPUTF8 international local parts
  remain unsupported; normal ASCII email addresses with IDNA domains supported.
- Development delivery queue is bounded and volatile, never persists plaintext
  OTPs. Restart can lose queued mail; resend after cooldown. Durable encrypted
  outbox/retry is a production deployment follow-up, not claimed implemented.
- Missing/weak identity secrets disable or reject enabling identity; never use
  fixed development verification codes. Local generated secrets remain ignored.
- Browser page implements registration/code entry and status. Customer-number
  login challenges require the future agent or trusted operator API.

## Ledger

- Initial tests failed because identity modules did not exist. PostgreSQL tests
  then exposed JSON null versus SQL NULL in cleared registration forms; mapping
  now uses JSONB none_as_null so constraints and wiping behave correctly.
- Windows lacked IANA timezone data; installed/pinned tzdata, preserving Cairo
  date rules instead of silently substituting UTC.
- Independent review found committed verification could return 503 when mail
  capacity filled. Regression reproduced it; delivery reservation now precedes
  challenge mutation and welcome-mail capacity cannot hide successful verification.
- Review also found terminal browser errors retained form/code data. The page
  now clears code immediately and resets sensitive form state on terminal failure.
- Added cumulative conversation send counter: 24-hour event retention must not
  reset the five-total OTP limit for a still-live conversation.
- New pending challenge wins polling over an existing verified binding, without
  extending session idle time. Reproduced the old verified-first behavior in a
  failing regression test before correcting it.
- SMTP/Mailpit delivery and mobile-width Chrome Arabic/English registration flow
  passed. No real inbox delivery has occurred; sender credentials are absent.
- Final evidence: 86 tests passed; lint/format/type/repository/whitespace checks
  passed. Docker migration/readiness and SMTP/browser checks passed. UI terminal
  recovery was checked; scoped synthetic rate counters were cleared for review.
  All changes remain uncommitted; CI/Oracle deployment are not claimed verified.
