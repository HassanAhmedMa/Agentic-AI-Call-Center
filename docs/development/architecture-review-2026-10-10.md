# Repository and ADR-003 review — 2026-10-10

## Scope and result

Reviewed the repository checkout at `805a2f8` on `docs/adr-003-identity-and-booking-rules`, its Phase 0 baseline, attached ADR/API/schema/tool files, architecture HTML, service instructions, requirements, setup/configuration, CI/validator and diagram sources. The attached ADR/API/database files match the committed versions; `tool-schemas.md` is the uncommitted replacement. The GitHub connector returned access errors; authenticated Git cloning worked. Remote PR ref 1 exists, but connector access did not permit review/check/approval metadata inspection.

The identity/session direction is a substantial improvement over model-supplied patient ids. Fixed aligned slots make the unique-index overlap design coherent. Approve the corrected documents for human review; this is not ADR acceptance, teammate approval or production-security certification. There is no application implementation to approve or runtime service suite to run yet.

## Findings corrected in this branch

| Priority | Finding | Correction |
|---|---|---|
| High | Idempotency hashes body only; same cancellation body on a different appointment can replay the wrong result | Include route target, operation and canonical validated body; persist mutation/history/replay atomically |
| High | Confirmation rejects already-used proposals yet promises retry; a new caller turn does not establish delivery or affirmative consent | Explicit lifecycle, serialized confirmation, delivery/turn tracking, retained immutable replay and documented LLM-consent limitation |
| High | 24-hour challenge deletion conflicts with non-null session FK retained for 30 days | Nullable `verified_via` with ON DELETE SET NULL; wipe pending forms earlier |
| High | Agent OTP calls appear to originate from the agent IP; count-then-insert rate limits race | Use backend-resolved conversation browser IP; trusted chain rules; atomic sorted bucket locks; equal unknown-account counting |
| High | Five-active rescheduling may count the moved visit again | Exclude it from total active and daily counts |
| High | Concurrent verification/account changes and registration uniqueness completion were underspecified | Common locks, session revalidation/replacement, challenge invalidation and completion-time email check |
| High | Human transfer examples imply a live connection before any endpoint exists; Phase 2 queue originally depends on Phase 6 staff auth | Truthful Phase 1 unavailable result; contract minimum staff auth with Phase 2 queue; separate queue/connection states |
| Medium | Free-text log truncation still exposes PII/codes; schema says masked email/challenge ids are returned | Omit values, explicit tool output allowlist; remove misleading schema descriptions |
| Medium | Several inputs are informal pseudotypes; tool/API names, fields and envelopes differ | Complete input schemas and deterministic adapter mapping; actual date/range validation required |
| Medium | Seven-day inclusive ranges previously allowed eight dates; successful reschedule example was on Friday | Six-day date difference; valid Saturday example |
| Medium | Old requirements, flows and diagrams select patients directly or use obsolete statuses/tools | Align source diagrams, rendered assets, service instructions, requirements and traceability |
| Medium | Browser form/control delivery and mobile OTP/resume dependencies were missing | Minimum text forms from Phase 1, bounded control contract, TLS/resume/liveness and device gate |

## Remaining decisions and pre-existing limitations

ADR-003 stays Proposed until supervisor, booking-rule/team and teammate review gates are satisfied. The original proposal/ten-phase roadmap is outside the supplied repository; this review cannot update it. Mailpit captures local mail and cannot deliver to personal inboxes. A mobile demo needs safe inbox access or an SMTP provider. OTP speech redaction is best effort; raw-audio-to-LLM providers need an isolation decision before use.

CODEOWNERS contains placeholder handles; actual team identities and protection settings must be supplied by the team. Remote HEAD points at the foundation branch while contribution instructions use main. Some legacy presentation/rendering helpers contain machine-specific paths and optional uninstalled dependencies; they are tooling debt, not completed service infrastructure. Existing foundation validation checks file presence/basic credential patterns, not contract correctness or full secret detection. Existing performance/accuracy figures are targets, not demonstrated guarantees.

## Validation

Run the repository foundation validator and `git diff --check`, parse all documented JSON and all 19 tool input schemas, audit updated local links/requirements traceability, validate Mermaid sources and regenerate changed SVG/PNG assets. Compose syntax requires `docker compose config -q`; if Docker is unavailable, record that limitation and use YAML structural inspection without claiming a container runtime test. No backend, migration, booking, OTP or mobile runtime tests exist yet.

See [implementation-roadmap.md](implementation-roadmap.md) for sequence, first implementation PR and external dependencies.

Verified locally: foundation validator passed (62 required files); all 19 closed tool input schemas and 49 Markdown JSON examples parsed; all 14 tables and 39 requirement ids mapped; updated local Markdown links resolved; 21 Mermaid sources parsed and 14 affected SVG/PNG pairs regenerated. git diff --check passed. Compose YAML structure and loopback Mailpit ports also passed inspection. Docker is unavailable, so Compose runtime/config validation remains for CI or a Docker-equipped teammate. Mailpit image/port configuration follows https://mailpit.axllent.org/docs/install/docker/.
