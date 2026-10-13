# AGENTS.md - Clinic Backend Guidelines for AI Coding Agents

> **SERVICE:** `services/clinic-backend`  
> **DOMAIN:** Deterministic Clinic Operations REST API & Relational Persistence  
> **CONTRACT REFERENCE:** [docs/architecture/api-contracts.md](../../docs/architecture/api-contracts.md)  
> **DB REFERENCE:** [docs/architecture/database-schema.md](../../docs/architecture/database-schema.md)

---

## 1. Service Responsibilities

This service is the **sole authority for clinic business rules and database mutations**.
- Exposes RESTful JSON endpoints under `/api/v1`.
- Enforces appointment invariants (e.g., zero overlapping slots for doctors or patients).
- Manages patients, doctors, services, appointments, and support tickets.
- Authenticates requests and authorizes operations.

---

## 2. Inviolable Rules for AI Agents Working on this Service

1. **Strictly Abide by API Contracts:**
   - All endpoints, request schemas, response codes, and error envelopes must match `docs/architecture/api-contracts.md` exactly.
2. **Transactional Integrity:**
   - Mutating actions (e.g. appointment creation and rescheduling) must use database transactions with appropriate locking to prevent race conditions / double bookings.
3. **No LLM Dependencies:**
   - This service must remain 100% deterministic. **Do not introduce LLM calls, embeddings, or AI prompt dependencies into this backend.**
4. **Synthetic Data Only:**
   - Any database seeds or test fixtures must use synthetic, non-identifiable test data.
5. **Validation at the Boundary:**
   - Every incoming request must be validated using Pydantic models derived from the shared contracts.

---

## 3. Technology Stack & Planned Architecture (Phase 1+)

- **Runtime:** Python 3.11+
- **Framework:** FastAPI
- **ORM / Database Driver:** SQLAlchemy (Async) / asyncpg
- **Migrations:** Alembic
- **Testing:** `pytest`, `pytest-asyncio`, `httpx`

---

## 4. Initial Phase 1 Status

Public catalog, health, conversations, registration/email verification, patient bindings, profile/logout and the bilingual registration page are implemented. Conversation end/expiry revokes identity. Public availability/search and revision 0004 scheduling persistence are implemented locally for review; Oracle remains at 0003 until approved deployment. Booking writes and agent operations remain planned. Reuse slot_rules.py for later booking validation, inside transaction/ownership/limit checks. Local SMTP/Mailpit and authenticated n8n delivery adapters are implemented. Oracle uses the published n8n workflow; credentials remain outside source control.
