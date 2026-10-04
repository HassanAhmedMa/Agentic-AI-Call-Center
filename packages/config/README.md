# Configuration Package (`packages/config`)

Centralized configuration management for services in the monorepo.

## Responsibilities
- Type-safe environment variable parsing (e.g. using `pydantic-settings`).
- Validates that required environment variables defined in `.env.example` are present at service startup.
- Sets sensible defaults for local development vs. production.
- Prevents accidental execution with dummy secret values in production.
