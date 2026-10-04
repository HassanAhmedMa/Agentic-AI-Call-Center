# Clinic Backend Service (`services/clinic-backend`)

REST API service responsible for clinic operations, scheduling, patient records, services catalog, and support tickets.

## Architecture Status
- **Current Phase:** Phase 0 (Foundation & Contracts)
- **API Contracts:** [docs/architecture/api-contracts.md](../../docs/architecture/api-contracts.md)
- **Database Schema:** [docs/architecture/database-schema.md](../../docs/architecture/database-schema.md)

## Planned Tech Stack (Phase 1+)
- **Language:** Python 3.11+
- **API Framework:** FastAPI
- **Database:** PostgreSQL 16+ via SQLAlchemy Async + asyncpg
- **Migrations:** Alembic (`database/migrations/`)

## Key Invariants
- Enforces strict appointment slot exclusivity (no double-booking).
- Never allows direct SQL queries from external callers or LLM components.
