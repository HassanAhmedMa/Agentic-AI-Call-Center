# Chat appointment integration plan

Approved scope now includes integration with latest UI, final checks, commit, push and deployment after verification.

- [x] Typed chat input and API-backed patient tools.
- [x] Verified portal identity and cookie handling.
- [x] Signed expiring proposals, later-turn consent and idempotent changes.
- [x] Doctor-specific confirmation, readable dates, loading and green success cards.
- [x] Patient-scoped browser threads and structured widget restoration.
- [x] Merge Hassan's f9e1bf2 changes without removing his doctor editor.
- [x] Unit, frontend, targeted database and live-provider smoke verification.
- [ ] Complete full database suite and final container checks.
- [ ] Commit, push and deploy the verified revision; check public service.

The inherited LLM adapter remains in clinic-backend; deterministic booking rules remain isolated behind HTTP APIs. No additional ports or shared environment changes. Pending proposal state supports one worker; shared durable proposal storage is not implemented. See docs/development/chat-appointment-integration.md for limitations and testing commands.
