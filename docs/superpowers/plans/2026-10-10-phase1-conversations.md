# Phase 1 conversation foundation

Implement API contracts §4.1–4.2 before patient registration. This reviewable
increment creates conversation sessions and shared PostgreSQL rate limits.
Registration, OTP verification and the bilingual identity page follow separately;
do not advertise those operations as implemented.

1. Write PostgreSQL-backed API tests for hashed tokens, strict input, service
   authentication, ten creations per IP/hour and lifecycle transitions.
2. Add frozen migration 0002 and ORM models. Lock the conversation row before
   lifecycle changes; repeated disconnects must not extend the resume window.
3. Authenticate service credentials before conversation lookup; persist expiry
   before returning an error. Use the socket IP and ignore forwarded headers.
4. Run unit/integration tests, formatting, lint, typing and Docker migration smoke.
5. Document scope and review URLs. Leave changes uncommitted for user review.

Patient-binding revocation will be added atomically when patient sessions exist.
Until then no patient authentication or verification-state route is exposed.
The gateway must later enforce single transport ownership before emitting events.

## Ledger

- Initial seven PostgreSQL tests failed with missing-route responses, then passed
  after implementation. Concurrency test accepts exactly ten of fourteen starts.
- Independent review found lifecycle timestamps captured before lock acquisition.
  Added a PostgreSQL lock-wait regression test and observed its failure; moved
  mutation timestamps after locking. Expiry uses the post-lock time too.
- Ruling: ship the conversation foundation as a separate reviewable increment
  before identity — no patient bindings exist yet, so identity revocation and
  verification responses must not be advertised as implemented.
- Final evidence: 52 tests passed; Black/Ruff/mypy/repository/whitespace checks
  passed. Docker rebuilt, migration applied and live lifecycle smoke passed.
  Changes are left uncommitted for human review on the existing branch.
- The user subsequently approved committing this increment on the same branch.
