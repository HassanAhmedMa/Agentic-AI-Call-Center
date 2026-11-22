# Shared Schemas Package (`packages/schemas`)

Single source of truth for shared data schemas, request/response models, and AI tool parameter contracts across the monorepo.

The initial implementation in `src/clinic_schemas/catalog.py` provides Pydantic v2 public catalog request/response DTOs. Install from the repository root with `python -m pip install -e '.[dev]'`. Other DTOs and TypeScript definitions remain planned.

## Purpose
- Contains shared Pydantic v2 and TypeScript type definitions for:
  - Backend API Data Transfer Objects (DTOs) from `docs/architecture/api-contracts.md`
  - AI Tool Input/Output Schemas from `docs/architecture/tool-schemas.md`
  - RAG Retrieval Contracts from `docs/architecture/rag-contract.md`
  - Voice Event Payloads from `docs/architecture/voice-architecture.md`

## Invariants
- Zero business logic; contains strictly data definitions, constraints, and serializations.
- Used across `services/clinic-backend`, `services/ai-agent`, and test suites.
