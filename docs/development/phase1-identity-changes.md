# Phase 1 identity — review guide

Registration, email verification, patient binding and the minimal bilingual
registration page are built locally. Changes remain uncommitted for human review.
No AI agent, voice gateway or appointment API is claimed implemented.

## Review the flow

1. Open http://localhost:8000/register and switch English/العربية as needed.
2. Submit synthetic details and accept the registration privacy notice.
3. Open the local inbox at http://localhost:8025. The mail is addressed to the
   submitted email; Mailpit captures it instead of sending it outside your machine.
4. Enter the six-digit code on the page. The verified patient is created and
   the customer number displayed and emailed. No account is created before this.
5. Inspect APIs at http://localhost:8000/docs. Login-code requests, profile and
   logout require service credentials; those never enter product browser code.

Codes expire after five minutes and permit three wrong attempts by default.
Sessions expire after 15 minutes idle or 60 minutes absolute. Polling does not
extend idle time. Conversation end/resume expiry revokes patient access.
Never verify ownership by matching name, phone or date of birth.

## Teammate setup

From the repository root, with Docker running:

    python scripts/setup_identity_dev.py
    docker compose up -d database mailpit
    docker compose --profile backend build clinic-backend
    docker compose --profile backend run --rm clinic-backend python -m alembic upgrade head
    docker compose --profile backend run --rm clinic-backend python -m clinic_backend.seed
    docker compose --profile backend up -d clinic-backend

The setup script generates separate random secrets in ignored .env, preserving
existing valid values. It enables identity and selects local Mailpit when no SMTP
host exists. Never commit or share .env. Each teammate has their own data.
Missing/weak secrets reject enabling identity. No fixed testing OTP exists.
For a host-run backend, use SMTP_HOST=localhost instead of the Docker host mailpit.

## Actual inbox delivery

The SMTP adapter can deliver the same verification emails through a configured
sender account. A recipient Gmail address is insufficient to authenticate a sender.
Configure SMTP_HOST, SMTP_PORT, SMTP_FROM, SMTP_USERNAME, SMTP_PASSWORD and
SMTP_USE_TLS in ignored .env, then recreate the backend container.

For an eligible Gmail sender: smtp.gmail.com, port 587, SMTP_USE_TLS=true,
SMTP_FROM/SMTP_USERNAME set to the sender address and SMTP_PASSWORD set to its
app password. Google requires 2-Step Verification for app passwords:
[Google account instructions](https://support.google.com/accounts/answer/185833).
Store credentials locally, never in chat, Git, browser JavaScript or logs.
Actual Gmail delivery has not been tested because sender credentials are absent.

SMTP STARTTLS is supported; implicit TLS on port 465 is not implemented. The
development queue is bounded, volatile and stores OTPs only in memory; a restart
may lose mail. Delivery failures log generic operator alerts without codes or
recipients. SMTP results do not distinguish known/unknown accounts in responses.
Durable encrypted delivery/retry and monitoring remain production follow-ups.
Do not put this development inbox on a public tunnel.

## Changed files and responsibilities

| Files | Responsibility |
|---|---|
| packages/schemas/src/clinic_schemas/identity.py | Registration/code inputs and typed identity outputs; normalized email, E.164 phone, Cairo DOB and consent validation |
| services/clinic-backend/src/clinic_backend/identity_models.py | Patient, challenge and verified-session ORM models |
| database/migrations/versions/0003_identity.py | Three identity tables, enums, uniqueness constraints and cumulative conversation OTP counter |
| database/migrations/env.py | Registers identity metadata for migrations |
| services/clinic-backend/src/clinic_backend/identity.py | HMAC codes, random Luhn customer numbers, locked registration/login/verification, atomic rate limits, profile/logout |
| services/clinic-backend/src/clinic_backend/identity_routes.py | Role guards, transactional endpoints and delivery reservations |
| services/clinic-backend/src/clinic_backend/mail.py | SMTP adapter and English/Egyptian Arabic code/account/duplicate notices |
| services/clinic-backend/src/clinic_backend/identity_cleanup.py | Periodic expiry, sensitive form/code wiping and contract retention |
| services/clinic-backend/src/clinic_backend/conversations.py | Revokes identity on end/resume expiry |
| services/clinic-backend/src/clinic_backend/models.py | Persistent send counter keeps five-total limit after rate-event cleanup |
| services/clinic-backend/src/clinic_backend/app.py | Identity routes, cleanup lifecycle, static page and corrected OpenAPI 422 responses |
| services/clinic-backend/src/clinic_backend/settings.py | Identity/SMTP secrets, TLS guard and default rate/session settings |
| services/clinic-backend/src/clinic_backend/static/register.html, register.css, register.js | Accessible mobile registration/code flow; Arabic RTL and English LTR; no service credential or persistent token storage |
| scripts/setup_identity_dev.py | Generates ignored local identity configuration |
| scripts/smoke_identity.py | Tests actual SMTP delivery into Mailpit without printing codes/tokens |
| tests/unit/test_identity.py, tests/integration/test_identity.py | Validation and PostgreSQL identity/security/concurrency regressions |
| pyproject.toml | Packages static assets; tzdata supplies IANA Cairo timezone data on Windows |
| docker-compose.yml, .env.example | Identity/SMTP configuration; no real credentials committed |
| .github/workflows/ci.yml | Existing full backend checks plus Docker/Mailpit smoke |
| README.md, AGENTS.md, backend README/AGENTS | Updated implementation status and setup |
| API/database/tool contracts, implementation roadmap | Implementation markers, cumulative send counter, pending-first polling; agent tools remain future work |
| docs/superpowers/plans/2026-10-10-phase1-identity.md | Implementation and verification ledger; no Superpowers plugin modification |
| docs/decisions/ADR-002-technology-candidates-and-scope-simplification.md | Records the small timezone-data packaging dependency required by the existing Cairo date contract |

The prior conversation/catalog change summaries are historical checkpoint records.
Their pending-feature notes describe those earlier increments.

## Verification evidence

- 86 unit/integration tests passed against local PostgreSQL, covering duplicate
  email races, double submission, wrong/expired codes, shared limiting, binding
  expiry/revocation, cleanup, queue capacity and polling. One pre-existing
  Starlette TestClient deprecation warning remains.
- Black, Ruff, strict mypy, repository validation and whitespace checks passed.
- Docker built, migration 0003 applied and readiness passed.
- Actual SMTP-to-Mailpit delivery and registration verification passed.
- Chrome mobile-width Arabic RTL / English LTR registration passed; terminal
  error recovery cleared form/code state. Synthetic test rate events were removed
  by exact operation timestamps so manual review begins with fresh limits.
- GitHub CI and Oracle deployment have not been verified for this increment.
- Gmail SMTP authentication and a test message were accepted successfully.
  On 2026-10-11, the user confirmed the live registration and OTP flow worked
  as expected with their configured Gmail sender. Sender credentials remain
  exclusively in the ignored local `.env`; teammates configure their own SMTP.

## Remaining deployment and development work

- Browser registration/code completion works now. Initiating customer-number login
  requires the agent or a trusted operator API, not a browser service-secret proxy.
- Socket IP is used; proxy headers are ignored. Configure/test trusted ingress
  before shared hosting. The public catalog limiter remains single-process.
- Default three registrations/IP/day and five OTP sends/conversation are enforced.
  Limits protect existing and unknown accounts equally; normalized email subjects
  are keyed hashes. Configuration settings are backend environment variables;
  use a Compose environment override to customize limits beyond defaults.
- Patient email uniquely identifies the account; phone is deliberately nonunique.
- Cleanup runs once a minute while identity is enabled and follows conversation
  locking. Challenge forms/code material are wiped on terminal states; cleanup
  removes 24-hour challenges/events and 30-day session/conversation history.
- Next development milestone: doctor availability, clinic closures/time off,
  then transaction-safe appointment booking and idempotent appointment writes.
- Shared Oracle hosting, production sender configuration, transport ownership,
  staff support and agent/voice integration remain future work.
