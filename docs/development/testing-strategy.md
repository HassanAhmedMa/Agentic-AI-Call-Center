# Testing Strategy & Verification Framework

> **PROJECT:** Agentic Clinic  
> **SCOPE:** Automated Verification Across Monorepo Services

---

## 1. The Testing Pyramid

```
                ┌────────────────────────┐
                │   LLM & Conversational │
                │   Evaluation Suites    │ (Accuracy, dialect safety, latency)
                ├────────────────────────┤
                │      End-to-End        │
                │      (E2E) Tests       │ (Full dialogue to DB state change)
                ├────────────────────────┤
                │   Integration Tests    │
                │ (Tool -> API, API->DB) │ (Service boundaries & contracts)
                ├────────────────────────┤
                │       Unit Tests       │
                │  (Schemas, Validators) │ (Fast, pure in-memory)
                └────────────────────────┘
```

---

## 2. Test Classifications

### 2.1. Unit Tests (`services/*/tests/unit/`)
- Test individual functions, Pydantic schemas, date parsers, and error mappers in complete isolation.
- Zero network or database dependencies.
- Target execution time: < 5 seconds for full suite.

### 2.2. Integration Tests (`tests/integration/`)
- Verify that `services/ai-agent` tool callers correctly communicate with `services/clinic-backend` REST endpoints according to `docs/architecture/api-contracts.md`.
- Verify database migrations and transactions against a local PostgreSQL test database.

### 2.3. End-to-End (E2E) Tests (`tests/e2e/`)
- Replay scripted multi-turn transcripts (in English and Egyptian Arabic).
- Validate that the complete pipeline (Utterance ➔ Intent ➔ Tool Call ➔ DB Mutation ➔ Natural Confirmation) executes accurately.

### 2.4. LLM & Conversational Evaluation (`tests/evaluation/`)
- Non-deterministic and LLM benchmark suites.
- Measures intent classification accuracy, tool selection precision, hallucination avoidance on RAG queries, and dialectal robustness.
- See [docs/evaluation/evaluation-plan.md](../evaluation/evaluation-plan.md) for details.

---

## 3. Mocking Strategy for Parallel Development

To allow all 5 team members and their AI agents to develop in parallel without blocking on unfinished services:
- **AI Agent Developers** use a mock HTTP server responding with fixtures from `docs/architecture/api-contracts.md`.
- **Backend Developers** test endpoints using `pytest-asyncio` and an ephemeral PostgreSQL test instance.
- **Voice Developers** test audio pipelines using pre-recorded PCM audio fixtures (`tests/fixtures/audio/`).
