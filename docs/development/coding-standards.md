# Coding Standards & Quality Guidelines

> **PROJECT:** Agentic Clinic  
> **SCOPE:** Python, TypeScript/JavaScript, SQL, and Architecture Schemas

---

## 1. General Principles

1. **Explicit is Better than Implicit:** Always declare types, schemas, and parameter constraints.
2. **Defensive Validation:** All data entering a service from an external boundary (HTTP, WebSocket, or LLM output) must be strictly validated.
3. **Fail Fast with Clear Errors:** Use domain-specific error exceptions that map directly to the error envelope defined in `docs/architecture/api-contracts.md`.
4. **No Dead Code:** Delete obsolete code; do not comment out large blocks of unused logic.

---

## 2. Python Standards (Services & Packages)

- **Version:** Python 3.11+
- **Style Guide:** PEP 8 compliance enforced via `ruff` and `black`.
- **Type Annotations:** Full static type annotations (`mypy` compliant) are required for all function arguments and return types.
- **Pydantic for Data Transfer Objects (DTOs):**
  - Use Pydantic v2 `BaseModel` for all request/response models and tool arguments.
  - Define clear field descriptions, regex constraints, and default values.
- **Async First:** I/O-bound operations (FastAPI endpoints, database queries, LLM calls, audio streaming) must use `async`/`await`.

```python
# Example Python Standard
from pydantic import BaseModel, ConfigDict, Field

class AppointmentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    # Patient identity is resolved from the verified backend session.
    doctor_id: int = Field(..., gt=0, description="Unique doctor ID")
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$", description="Date YYYY-MM-DD")
    start_time: str = Field(..., pattern=r"^([01][0-9]|2[0-3]):(00|30)$", description="Cairo time HH:MM")
    visit_reason: str | None = Field(default=None, max_length=300)
```

---

## 3. TypeScript Standards (Voice Layer / Web UI)

- **Version:** TypeScript 5.0+ with strict mode enabled (`"strict": true`).
- **Style Guide:** Enforced via `eslint` and `prettier`.
- **Type Safety:** Disallow usage of `any`. Use `unknown` with type narrowing or Zod schemas.

---

## 4. SQL & Database Conventions

- All table names and column names must be `snake_case` and pluralized for tables (e.g. `patients`, `appointments`).
- Primary keys must be named `id`.
- Foreign keys must be named `<singular_entity>_id` (e.g. `doctor_id`).
- Timestamps must include timezone (`TIMESTAMPTZ`) and default to `NOW()`.
- Explicit constraints (foreign keys, checks, unique compound indexes) must back all business rules.
