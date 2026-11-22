# First Phase 1 catalog: change summary

Date: 2026-10-10. Status: local implementation verified; user authorized the same-branch commit checkpoint. Shared Oracle hosting agreed, not yet provisioned. This inventory covers the current slice, not the earlier documentation commit `1a3f604`.

## What now works

Public health/readiness, bilingual specialties/doctors/services, English/Egyptian Arabic doctor search, PostgreSQL migrations and synthetic seeds. Identity, conversation sessions, availability, booking, tickets, agent tools, UI and voice remain planned. Idempotency is specified for future write operations; it is not implemented by these read-only catalog APIs.

Verification before the documentation notes: 41 tests passed against real PostgreSQL, plus lint, formatting, type checks, repository validation and live HTTP smoke tests. Docker Desktop engine and Compose configuration validate. The backend image built successfully; container migrations, seeds, readiness, bilingual doctor search, catalog counts and non-root execution passed on Linux/Python 3.11. Both containers are healthy at localhost:8000 (API) and localhost:5432 (database). GitHub CI and ARM deployment remain unverified. Oracle deployment has not occurred.

## Contracts versus implementation

The API/database/tool documents already describe the target design from the earlier documentation commit. This slice follows those contracts rather than inventing new endpoints or changing the tool schemas. New status notes identify what is implemented versus planned. The three-table migration additionally rejects NULL working-day elements. Shared public rate limits, trusted ingress and deployment controls remain required before public exposure.

## Files included in the commit checkpoint

Inventory captured before committing: 42 files, comprising 15 modified and 27 new. The user authorized committing these files on the existing branch. Exclude local environments, database contents, credentials, logs, portable PostgreSQL binaries and wheel/build artifacts outside the repository.

| File | Change | Responsibility |
|---|---|---|
| `.dockerignore` | New | Exclude secrets, local environments and development artifacts from Docker context. |
| `.env.example` | Modified | Updated the backend URL to the asyncpg PostgreSQL driver; template only, no real secrets. |
| `.github/workflows/ci.yml` | Modified | Added backend checks, real PostgreSQL tests, image build and container smoke tests. |
| `.gitignore` | Modified | Ignore temporary pytest cache directories. |
| `AGENTS.md` | Modified | Mark the initial Phase 1 implementation status for contributors/agents. |
| `README.md` | Modified | Describe implemented catalog scope and link runnable setup. |
| `alembic.ini` | New | Locate Alembic migrations and backend imports. |
| `database/migrations/env.py` | New | Run PostgreSQL migrations using runtime configuration or an injected test connection. |
| `database/migrations/versions/0001_catalog.py` | New | Create the three catalog tables, foreign keys, indexes and price/shift constraints; reversible migration. |
| `database/seed/catalog.json` | New | Fictional bilingual data: five specialties, ten doctors, fifteen services and Egyptian synonyms. |
| `docker-compose.yml` | Modified | Add opt-in backend container, database readiness checks and localhost port bindings. |
| `docs/architecture/api-contracts.md` | Modified | Add an implementation-status note; endpoint behavior and future idempotency contract remain unchanged. |
| `docs/architecture/database-schema.md` | Modified | Mark the three implemented tables and target/deferred schema; document NULL-day rejection. |
| `docs/architecture/tool-schemas.md` | Modified | Mark agent tools and Phase 2 handoff as unimplemented; preserve target schemas. |
| `docs/development/implementation-roadmap.md` | Modified | Record current public slice and remaining implementation/acceptance steps. |
| `docs/development/phase1-catalog-changes.md` | New | This file: exact pending-file inventory, responsibilities and contract/hosting clarification. |
| `docs/development/setup.md` | Modified | Update prerequisites and team setup status; each teammate has a local database. |
| `docs/superpowers/plans/2026-10-10-phase1-catalog.md` | New | Implementation scope, decisions, independent-review fixes and verification evidence. |
| `packages/schemas/README.md` | Modified | Document the executable public DTO package and deferred schemas. |
| `packages/schemas/src/clinic_schemas/__init__.py` | New | Initialize the shared schema package. |
| `packages/schemas/src/clinic_schemas/catalog.py` | New | Typed public request/response models, bilingual fields, money, pagination and input bounds. |
| `pyproject.toml` | New | Installable Python packages, dependency pins, development tools and test/lint/type configuration. |
| `scripts/validate_repo.py` | Modified | Scan tracked/unignored files; avoid vendor CA/local-env false positives while rejecting tracked secrets. |
| `services/clinic-backend/AGENTS.md` | Modified | Distinguish implemented public endpoints from deferred identity/booking operations. |
| `services/clinic-backend/Dockerfile` | New | Build/run the backend on Python 3.11 with a non-root account and one local worker. |
| `services/clinic-backend/README.md` | Modified | Install, migrate, seed, run, Docker, test and team workflow instructions; deployment limitations. |
| `services/clinic-backend/src/clinic_backend/__init__.py` | New | Initialize the deterministic backend package. |
| `services/clinic-backend/src/clinic_backend/app.py` | New | Register HTTP routes, request IDs, validation handlers and bounded local rate limiting. |
| `services/clinic-backend/src/clinic_backend/catalog.py` | New | Query active doctors/available services; filter, count, paginate and map records to public DTOs. |
| `services/clinic-backend/src/clinic_backend/database.py` | New | Create async database connections and check the applied Alembic migration head for readiness. |
| `services/clinic-backend/src/clinic_backend/errors.py` | New | Typed, sanitized error envelopes and safe validation metadata. |
| `services/clinic-backend/src/clinic_backend/models.py` | New | ORM catalog tables, relationships and deterministic database constraints. |
| `services/clinic-backend/src/clinic_backend/search.py` | New | Shared Arabic/English normalization rules for incoming queries and stored catalog search material. |
| `services/clinic-backend/src/clinic_backend/seed.py` | New | Atomic synthetic seeding; repeat runs preserve existing records and avoid duplicate rows. |
| `services/clinic-backend/src/clinic_backend/settings.py` | New | Environment configuration with secret-safe PostgreSQL URL validation. |
| `tests/integration/conftest.py` | New | Isolated disposable PostgreSQL schema fixture and migration setup/cleanup. |
| `tests/integration/test_api.py` | New | HTTP contract tests: health, catalog, validation, safe errors and database failures. |
| `tests/integration/test_catalog.py` | New | Real PostgreSQL search/filter/seed/constraint and migration round-trip tests. |
| `tests/unit/test_api.py` | New | HTTP contract tests: health, catalog, validation, safe errors and database failures. |
| `tests/unit/test_repo_validator.py` | New | Regression tests for ignored vendor/local files and rejection of tracked/unignored secrets. |
| `tests/unit/test_search.py` | New | English and Egyptian Arabic normalization examples. |
| `tests/unit/test_settings.py` | New | PostgreSQL-only configuration validation. |

## Agreed hosting direction

Keep independent local PostgreSQL databases for development and add a shared hosted environment for team/demo access. Oracle Always Free currently documents 2 Arm OCPUs, 12 GB RAM, 200 GB combined boot/block storage and 10 TB monthly outbound transfer. Free Trial credits are a separate time-limited offer. Idle Always Free VMs may be reclaimed, so this is not guaranteed uninterrupted hosting. Verify actual account/region capacity and eligibility before provisioning. [Oracle Always Free documentation](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm), [trial FAQ](https://www.oracle.com/cloud/free/faq/).

The agreed Oracle VM direction is to run our PostgreSQL and backend containers; it would not change our database engine to Oracle Database. Before deployment, record the hosting decision, verify ARM images, configure HTTPS ingress/shared limits, keep the database private, add persistent storage, restart policies, off-server backups/restore tests and monitoring. Give teammates private database access through SSH/VPN if needed; applications call the backend API. If continuous availability is a hard guarantee, choose an appropriately supported paid deployment rather than relying on a reclaimable free VM.
