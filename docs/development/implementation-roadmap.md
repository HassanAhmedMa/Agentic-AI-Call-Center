# Implementation roadmap

Date: 2026-10-10. Current state: Phase 0 documentation and infrastructure scaffolding; no application, migrations or executable service tests yet. This is a proposed implementation sequence, not evidence of accepted scope or completed milestones.

## Start decision

Finish the current ADR-003 PR, record teammate review, agree booking values and obtain supervisor approval for browser calls. Keep ADR-003 Proposed until its gates are met. The referenced original ten-phase roadmap/proposal is not present in this repository or the supplied files; do not claim it has been updated. This roadmap supplies a repository-owned sequence using the phase labels referenced by ADR-003. Approximate week ranges below fit the earlier 12-week goal but are planning estimates to revise after Phase 1.

Avoid another round of broad design documents. Existing API/schema/tool contracts are enough for a first vertical slice after approval. Add executable schemas, migrations and tests as implementation deliverables. Before each deferred feature, specify its missing interface in the same PR.

## Phases and acceptance gates

| Phase | Deliverables in dependency order | Acceptance gate | Planning window |
|---|---|---|---|
| 0 — Close contracts | ADR approvals; corrected contracts/diagrams; assign backend, agent, web, RAG, voice and test owners; replace CODEOWNERS placeholders with actual GitHub handles | Human review; supervisor channel approval; values agreed; foundation checks pass; ADR checklist reconciled | Before implementation |
| 1 — Deterministic backend + minimal text/forms | Python packaging/tooling; shared Pydantic DTOs and settings; initial Alembic migration and synthetic seeds; catalog/availability; conversation lifecycle; email challenge + browser code/registration forms; session ownership; booking/reschedule/cancel/tickets with transactions/idempotency; health/readiness | Fresh DB migrate/seed; public search without auth; typed OTP verifies; foreign ids return 404; exact time boundaries; 5-active reschedule succeeds; concurrent limits/slot conflicts; rollback/retry; cleanup works; no mock provider outside development/test | Weeks 1–3 |
| 2 — Agent text workflow + minimum staff queue | Deterministic dispatcher/API mapping, state-filtered 19 tools, proposals, delivery/turn checks and unknown-outcome reconciliation; LLM adapter with mocked tests first; specify escalation table/endpoints AND minimum staff login/roles/queue read/accept contracts; implement authenticated queue and truthful status | Arabic/English login→proposal→yes→one booking; no/ambiguous/undelivered summaries do not write; session switch blocks replay; injected patient ids/codes/tokens rejected; unverified handoff request allowed; staff data never public; queued does not mean connected | Weeks 3–5 |
| 3 — RAG | Approved bilingual synthetic policies/FAQs; ingestion/retrieval adapters; explicit no-answer threshold and source metadata; embedded vector store baseline, with provider choice recorded before adding dependencies | Source-backed policy answers; no invented prices/availability/refunds; no low-confidence answer; RAG cannot mutate or authorize | Weeks 4–6 |
| 4 — Mobile browser voice spike | VoiceProvider cascaded baseline, WSS microphone playback, control events, redaction and resume; HTTPS ingress; actual device tests | Android/iPhone, Wi-Fi/4G, inbox app switch, reconnect, permissions, speaker/earphones; no code route through agent; measured latency report | Weeks 5–7 |
| 5 — Conversation and voice reliability | Barge-in, cancellation of generation, duplicate/out-of-order controls, liveness and resumption tests; prompt/tool regression datasets | Interrupted summaries require delivery again; dropped sockets cannot end resumed calls; retries produce one action; failures explained accurately | Weeks 7–8 |
| 6 — Security hardening | Harden existing auth; staff-role review; audit-log contract/migration; proxy/CORS/secret guards; adversarial identity/code/rate-limit tests; retention job | Multi-worker rate limits; enumeration checks; no secrets/PII/code request bodies in logs; logout/account-switch races; expiry and cleanup verified against PostgreSQL | Weeks 8–9 |
| 7 — Integrated mobile call milestone | Mobile browser call reaches the agent and executes a real verified backend action with RAG and truthful escalation | Complete recorded synthetic mobile scenario plus failure scenario; measured latency/cost, no unimplemented transfer claims | Weeks 9–10 |
| 8 — Minimum operations UI | Authenticated staff queue and ticket work; add staff scheduling/closure and appointment completion contracts only if necessary for demo | Ownership/role tests and session expiry; manual changes audited; no uncontracted staff operations | Weeks 9–10 |
| 9 — Evaluation and release candidate | Curated English/MSA/Egyptian/code-switch dialogues; tool accuracy, date extraction, safety and retrieval checks; Docker service definitions and repeatable setup | Published reproducible scorecard; deterministic invariants pass; clean-machine setup; measured metrics distinguished from targets | Weeks 10–11 |
| 10 — Demo and submission | Mobile browser call→AI→backend action; registration/login, booking, cancellation/conflict and queue demonstration; setup/runbook and limitations | Supervisor-aligned demo; frozen synthetic seeds; repeatable rehearsals and documented fallback | Weeks 11–12 |

## First implementation PR

After ADR acceptance, create a small Phase 1 PR for packaging/settings, PostgreSQL migration/seed, health endpoints and bilingual catalog. Next implement conversation + email verification + minimal text form page, then booking transactions. Keep the first PR small enough for a teammate to review; do not build the whole project in one PR.

Suggested module deliverables (adapt filenames to the agreed package layout): `pyproject.toml`, backend app/settings, `packages/schemas` DTOs, Alembic configuration and initial migration, seed runner, unit/integration tests, then the minimal web page. Add a frontend directory only when its owner/runtime is agreed. Mock LLM/SMTP/provider adapters support parallel work, but PostgreSQL integration tests must exercise the real constraints/locking.

## External work and decisions

- Supervisor/team lead: confirm the browser-call replacement in the university proposal and original roadmap outside this repo. Assign owners; do not treat AI review as teammate approval.
- Omar + Ziad (proposed in ADR): confirm lead time, horizon, cutoff and account limits. Confirm synthetic-demo identity limitations.
- Web owner: own text forms from Phase 1, not only a later dashboard; agree origin/TLS deployment and mobile device access.
- Repository administrator: replace placeholder CODEOWNERS, inspect default branch (currently remote HEAD points to `feature/phase-0-foundation`) and protection/PR base strategy. Decide how the foundation branch reaches `main` before feature work.
- DevOps: Docker/Compose available locally; HTTPS tunnel/domain; protected Mailpit inbox access or real SMTP for mobile demos; separate random service/HMAC secrets and trusted proxy list.
- Provider owners: choose/benchmark LLM, STT, TTS and embeddings; arrange credentials/budget when integrating live providers. No provider secret is needed for contract review or mocked implementation.

Live telephony, variable appointment durations, clinical diagnosis, payments, extensive dashboards, dedicated vector clusters and distributed tracing remain beyond the bounded demo. If supervisor requires telephony, revise channel scope deliberately before implementing voice.
