# Clinic Backend Service (`services/clinic-backend`)

Deterministic FastAPI backend with public catalog and conversation creation/lifecycle. Patient identity and bookings remain pending. Run commands below from the repository root.

## Architecture Status
- **Current Phase:** Phase 1 — Public catalog and conversation foundation
- **API Contracts:** [docs/architecture/api-contracts.md](../../docs/architecture/api-contracts.md)
- **Database Schema:** [docs/architecture/database-schema.md](../../docs/architecture/database-schema.md)

## Tech Stack
- **Language:** Python 3.11+
- **API Framework:** FastAPI
- **Database:** PostgreSQL 16+ via SQLAlchemy Async + asyncpg
- **Migrations:** Alembic (`database/migrations/`)

## Implemented and planned

Implemented: `/api/v1/health`, `/health/ready`, `/specialties`, `/doctors`, `/doctors/{id}`, `/services`, `/services/{id}`. All paths use the `/api/v1` prefix. OpenAPI UI is at `/docs`.

English and Arabic names/descriptions are returned together. Doctor search accepts normalized English, Egyptian specialty terms (`قلب`, `جلدية`, `عيال`, `عضم`, `باطنة`) and Arabic letter/diacritic variants. Category values and error codes remain stable English machine identifiers. User-facing error translations belong to the later Arabic/English UI/agent.

Not implemented yet: identity/email verification, conversations, availability, booking, support tickets, AI tools, RAG, voice and patient UI. There are no placeholder action endpoints. Working hours are catalog information, not bookable availability.

The three-table migration is intentionally incremental. Later migrations add the remaining schema before the corresponding API is exposed. The backend owns database access; the LLM never receives database credentials.

## Run with Docker (recommended for the team)

Install Docker Desktop with Compose, then:

```bash
docker compose --profile backend build clinic-backend
docker compose up -d database
docker compose --profile backend run --rm clinic-backend python -m alembic upgrade head
docker compose --profile backend run --rm clinic-backend python -m clinic_backend.seed
docker compose --profile backend up -d clinic-backend
```

Open <http://localhost:8000/docs>. Check <http://localhost:8000/api/v1/health/ready>. Try `GET /api/v1/doctors?q=قلب` and `q=heart`; both return the same synthetic cardiologists.

Migrations and seeds are explicit commands; API startup never changes your schema or data. Re-running seeds inserts missing synthetic IDs and preserves existing rows. Use a dedicated demo database, not a populated production database. Seeded names, prices and descriptions are fictional.

Stop with `docker compose --profile backend down`. This preserves the database volume. Do not use `down -v` unless you intentionally want to erase local data. Database, cache, email inbox and backend ports bind to localhost.

## Run Python on the host

Use Python 3.11+ and PostgreSQL 16. Docker can provide just PostgreSQL with `docker compose up -d database`. A separately installed local PostgreSQL server also works.

```bash
python -m venv .venv
```

Activate with `.venv\Scripts\Activate.ps1` on PowerShell, or `source .venv/bin/activate` on Bash. Then:

```bash
python -m pip install -e '.[dev]'
```

Set the connection URL in your shell, using your own local credentials. Example for the default synthetic Compose database:

```powershell
$env:DATABASE_URL='postgresql+asyncpg://clinic_user:clinic_password@localhost:5432/clinic_db'
```

```bash
export DATABASE_URL='postgresql+asyncpg://clinic_user:clinic_password@localhost:5432/clinic_db'
```

```bash
python -m alembic upgrade head
python -m clinic_backend.seed
python -m uvicorn clinic_backend.app:create_app --factory --host 127.0.0.1 --port 8000 --workers 1 --no-proxy-headers
```

Settings read environment variables, not `.env` implicitly. Compose reads its substitution values from `.env`; the backend container receives its internal database URL explicitly. Percent-encode special characters in URL credentials. Redis and Mailpit are not required by this catalog slice.

## Tests and checks

Set `TEST_DATABASE_URL` to a disposable PostgreSQL database (PowerShell `$env:TEST_DATABASE_URL=$env:DATABASE_URL`, Bash `export TEST_DATABASE_URL="$DATABASE_URL"`). Tests create and remove isolated random schemas; never point tests at production. Without this variable, PostgreSQL tests skip, so a green unit-only run is not full verification.

```bash
python -m pytest -q
python -m ruff check services/clinic-backend/src packages/schemas/src tests/unit tests/integration database/migrations
python -m black --check services/clinic-backend/src packages/schemas/src tests/unit tests/integration database/migrations
python -m mypy
python scripts/validate_repo.py
```

GitHub CI runs the PostgreSQL tests, builds the image and smoke-tests migrated/seeded containers. Local Docker build, migrations, seeds, health checks, bilingual API smoke tests and non-root execution passed on 2026-10-10. GitHub CI and ARM-host execution remain pending.

## Team workflow and deployment boundary

After review and push, teammates pull the branch, install/build, migrate and seed their own database. Share changes through branches and reviewed pull requests. Commit migration files and synthetic catalog JSON; never commit database dumps, `.env` files or real patient data. Docker standardizes the runtime while each developer keeps independent data.

A shared hosted PostgreSQL database (including Supabase PostgreSQL) can be added for a team demo later. Keep the FastAPI/database boundary and use provider-approved direct/session connections, verified TLS, restricted credentials and a reviewed hosting decision before public exposure. Supabase Auth would be a separate identity design decision.

Current rate limiting is 60 catalog requests per IP per sliding minute in **one local process**; health probes are exempt. Forwarded IP headers are ignored and the documented launch commands disable proxy header trust. This slice is local-development software. Before public ingress or multiple workers, implement shared atomic limits, explicit trusted proxies, deployment hardening and the planned identity controls. Do not publicly expose this development server or synthetic mail inbox.

## Inspect your local database

For API/data review, open http://localhost:8000/docs. For SQL inspection, use your terminal:

```bash
docker compose exec database psql -U clinic_user -d clinic_db
```

Or open Docker Desktop → Containers → agentic_clinic_postgres → Exec, then enter `psql -U clinic_user -d clinic_db`. These defaults apply to the synthetic Compose setup; use your configured user/database if changed.

```sql
\dt
SELECT id, name_en, name_ar FROM specialties ORDER BY id;
SELECT id, name_en, name_ar, specialty_id, consultation_fee FROM doctors ORDER BY id;
SELECT id, name_en, name_ar, category, price FROM services ORDER BY id;
```

Use `\d doctors` to inspect columns/constraints and `\q` to exit. The three catalog tables, conversation sessions, rate-limit events and Alembic's version table now exist; patient/appointment tables come later.

# Conversation increment

Conversation creation and service-authenticated lifecycle are available at
`/api/v1/conversations`. See the
[review notes](../../docs/development/phase1-conversation-changes.md) for setup,
scope and security boundaries. Registration and verification remain pending.
