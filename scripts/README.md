# Developer & Repository Scripts (`scripts/`)

Tooling for repository validation, linting, testing, and developer productivity.

## Scripts
- `validate_repo.py`: Validates monorepo structure, checks that all architecture contracts, issue templates, and `AGENTS.md` constitutions exist, and verifies that no secrets or `.env` files are accidentally checked in. Used by developers locally and in CI (`.github/workflows/ci.yml`).
