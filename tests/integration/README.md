# Integration Tests (`tests/integration`)

Cross-service and boundary integration tests.

## Purpose
- Validates the tool-to-backend communication contracts:
  - Invoking AI tools against running or mocked `services/clinic-backend` REST endpoints.
  - Ensuring status codes and error envelopes match `docs/architecture/api-contracts.md`.
- Validates database transaction rollback and concurrent booking collision locks.

## Execution (Phase 1+)
```bash
pytest tests/integration/
```
