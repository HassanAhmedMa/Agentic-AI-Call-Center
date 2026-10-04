# Database Infrastructure & Schemas (`database/`)

Persistence management, migrations, and seed datasets for Agentic Clinic.

## Directory Structure
- `migrations/`: Versioned database migration scripts (Alembic / SQL) defining table creation, indexes, and constraints.
- `seed/`: Deterministic synthetic seed data for local testing, doctor rosters, and service catalogs.

## Invariant
- Accessible **only** by `services/clinic-backend`. Direct connections from LLMs or external agents are prohibited.
- Schema definitions and constraints are documented in [docs/architecture/database-schema.md](../docs/architecture/database-schema.md).
