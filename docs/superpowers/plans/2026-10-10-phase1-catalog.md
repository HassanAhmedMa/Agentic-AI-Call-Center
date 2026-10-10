# Phase 1 public catalog implementation plan

> Execution: implement inline using executing-plans and TDD. User requested a working build before review; leave all changes uncommitted on the existing branch.

**Goal:** A runnable PostgreSQL-backed FastAPI catalog with English and Egyptian Arabic discovery, synthetic seeds, migrations and health checks.

**Architecture:** `services/clinic-backend/src/clinic_backend` owns database access, normalization, catalog queries and API routing. `packages/schemas/src/clinic_schemas` owns public DTOs. Initial migration creates only specialties, doctors and services; later migrations add identity and booking tables before those features are exposed.

**Tech stack:** Python 3.11+, FastAPI/Pydantic, SQLAlchemy async/asyncpg, Alembic, pytest/httpx, ruff/black/mypy; PostgreSQL 16.

**Spec:** Existing `docs/architecture/api-contracts.md` §§1–3, 5.1–5.3 and 5.6–5.7; `database-schema.md` §§4.1, 4.2 and 4.5; `implementation-roadmap.md` first implementation PR.

## Constraints and review focus

- Use only synthetic catalog data. Patient endpoints, availability and booking are not exposed until implemented.
- Return stored Arabic/English names; normalize Egyptian specialty synonyms, Arabic letter variants, diacritics and tatweel. Normalize both stored search material and incoming queries in the same function.
- Match contract DTOs, money objects, pagination totals and unknown/inactive 404 behavior. Reject malformed and unknown query fields with the documented 400 envelope; never echo submitted values.
- Database-down or missing migration state yields readiness 503, while liveness remains 200. Check current Alembic head, not just connectivity.
- Test literal `%`/`_` search inputs, Arabic variants, combined filters, pagination, inactive entries and bad query parameters. SQL query construction must be parameterized.
- No new provider calls or credentials. Keep service docs explicit about implemented versus planned functionality. No auto-commit/push.

## Task 1 — Public contract and search tests

Files: root `pyproject.toml`; shared DTO package; backend `search.py`; `tests/unit/test_search.py` and `tests/unit/test_settings.py`.

- [x] Write failing tests for Egyptian synonyms/normalization and PostgreSQL-only settings validation.
- [x] Observe failures for missing implementation, then implement `normalize_search(text: str) -> str` and typed settings/DTOs.
- [x] Run tests, lint and type checks.

## Task 2 — PostgreSQL catalog and deterministic seeds

Files: backend `models.py`, `database.py`, `catalog.py`, `seed.py`; `database/seed/catalog.json`; `alembic.ini`, migration environment and `0001_catalog.py`; `tests/integration/test_catalog.py`.

- [x] Write tests that migrate an isolated test schema, seed twice, query Arabic/English names and filters, and reject invalid shifts/negative prices.
- [x] Observe failures, implement the three contract tables and constraints, atomic idempotent seed insertion and SQL catalog filtering with escaped LIKE literals.
- [x] Verify upgrade/downgrade/upgrade, seed counts, no duplicates, async queries and schema isolation on PostgreSQL.

## Task 3 — HTTP application and development workflow

Files: backend `app.py`, `errors.py`, routes; `tests/unit/test_api.py`; backend Dockerfile; Compose/CI/setup/service README.

- [x] Write failing HTTP tests for liveness/readiness, catalog envelopes, pagination/filter errors and unknown resources; use the real repository in PostgreSQL integration tests.
- [x] Implement app factory/dependency injection, sanitized errors and request correlation, and public endpoints only.
- [x] Add reproducible install/run/test commands, PostgreSQL integration CI and backend Compose profile. Start a local review server when database access is available.
- [x] Run full pytest, formatting, lint, mypy, foundation validation and diff checks; document any unavailable runtime checks and leave work uncommitted.

## Decisions and execution evidence

Ruling: build the public catalog first rather than all 14 proposed tables. This makes the first change reviewable and avoids exposing half-built patient operations. Adding remaining tables uses subsequent non-destructive migrations.

Ruling: remain in the user's existing checkout/branch because the user requested review before committing on that branch. No worktree or commits are created.

Task 1: complete — normalization/settings tests observed RED (missing modules, then malformed URL case), then GREEN 11/11. Ruff/Black and mypy passed after implementation.

Task 2: complete — repository tests observed RED (missing catalog module), then GREEN with real PostgreSQL 16.15. Combined normalization/catalog suite: 24/24. Upgrade/downgrade/upgrade, repeated seeds, inactive resources and database constraints passed.

Task 3: HTTP tests observed RED (missing app module), then GREEN. Combined suite: 29/29 on PostgreSQL. Installable editable package, lint/format and mypy passed.

Task 3 Ruling: use a bounded in-process sliding-window public limiter for this single-process local slice. Shared atomic limits and explicit proxy configuration are mandatory before scaling/public exposure. Cost if wrong: rate limits can be bypassed across multiple processes; docs/launch commands restrict this slice to local single-process use.

Task 3 Ruling: PostgreSQL 16.15 portable runtime outside Git replaces unavailable Docker for local database tests. Docker build/smoke validation is added to CI but is not claimed to have run locally. Cost if wrong: container-specific failures remain possible until CI/local Docker succeeds.

Final review: independent read-only reviewer identified two Important issues; no Critical or Minor findings. Fixed both in one TDD pass.

Final: fixed PostgreSQL-unrepresentable IDs/offsets and NUL text filters — seven HTTP regressions RED (503) → GREEN (400 with sanitized field metadata). Fixed missing details.fields — metadata/unknown-field privacy regression RED → GREEN. Also verified OpenAPI no longer advertises the default 422 validation response; regression RED → GREEN.

Final verification: `python -m pytest -q` with TEST_DATABASE_URL on PostgreSQL 16.15 → 41/41 passed, no skipped integration tests (260.32 s; one upstream Starlette TestClient deprecation warning). Ruff, Black, mypy (11 source files), repository validator (62 required files), YAML parse and `git diff --check` passed. Real CLI Alembic upgrade/seed and live HTTP English/Arabic discovery, readiness and invalid-input smoke checks passed. Seeded review API is running at http://localhost:8000/docs. Docker/CI execution remains pending; no container success claim.

Final: Ruling: distributed limits and forwarded ingress support — local single-process mode only; shared atomic limits/trusted proxies precede deployment. Cost if wrong: rate-limit bypass or incorrect client attribution in a multi-worker/proxy deployment.

Final: Ruling: identity, availability, booking, tools and UI — explicitly deferred to later authorized slices; public catalog never claims to execute those actions. Cost if wrong: those end-to-end workflows are unavailable until implemented.

Final: Ruling: Docker image execution/CI success — only configuration inspection and YAML parse completed here; retain the explicit pending status. Cost if wrong: container-specific failures can remain until an actual build/smoke run.

Final: Ruling: concurrent staff catalog writes and count/list snapshots — no catalog mutation endpoint is exposed in this slice. Revisit transaction isolation with staff writes. Cost if wrong: later concurrent changes could make totals and page contents briefly disagree.

Final: Ruling: universal Unicode/locale equivalence — only specified English/Egyptian Arabic behavior is claimed and tested; no unsupported-language guarantee. Cost if wrong: unusual out-of-scope text can normalize differently across Python/PostgreSQL locales.

Final branch state: docs/adr-003-identity-and-booking-rules; HEAD remains 1a3f604bf4264c50b4d9c2cd2341f4d23d541539. User requested review before any new commit/push. Preserve checkout, plan and uncommitted changes. No new PR, commits or push were created by this implementation.

Follow-up 2026-10-10: Docker Desktop installed. Actual engine access and Compose config passed. Initial image pull failed because the calling process had not inherited the new credential-helper PATH; adding Docker resources/bin to this process PATH resolved it without changing credential configuration. Backend Linux/Python 3.11 image build, container Alembic upgrade, synthetic seed, health/readiness, English/Egyptian Arabic search and catalog counts passed. Both containers report healthy; backend UID 1000 confirms non-root execution. Local Docker verification supersedes earlier pending local-container status; GitHub CI and ARM execution remain pending. Public contract progress markers and exact 42-file change inventory added. Oracle hosting researched only, not provisioned. No commit or push.

Commit checkpoint authorized by user on 2026-10-10. Agreed local development plus shared Oracle team/demo hosting, with provisioning pending. Database inspection commands added to the backend guide. Preserve earlier verification/history as evidence; the earlier no-commit decision is superseded by this explicit request.
