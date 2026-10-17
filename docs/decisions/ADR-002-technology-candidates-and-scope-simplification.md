# ADR-002: Technology Candidates, Scope Simplification & 12-Week Graduation Project Feasibility

- **Status:** Accepted
- **Date:** 2026-10-05
- **Deciders:** Agentic Clinic Team (5 Software Engineering Students & Lead Architect)
- **Consulted:** Project Stakeholders & Faculty Advisors
- **Related Audit:** [docs/architecture/feasibility-audit.md](../architecture/feasibility-audit.md)

---

## 1. Context & Problem Statement

**Phase 1 packaging note (2026-10-10):** the existing Africa/Cairo date contract
requires IANA timezone data. Windows Python lacks an OS timezone database, so the
backend pins Python's tzdata distribution. This adds timezone data for the approved
Python backend, without introducing another service or changing the architecture.
The Phase 0 architecture baseline established strong boundaries (modular monorepo, strict API contracts, no direct DB access for LLMs). However, our comprehensive feasibility audit identified several components that introduce excessive operational complexity, high financial cost, or high delivery risk for a five-person student team operating on a 12-week timeline:
1. **Telephony & WebRTC:** Traditional PSTN phone connectivity and WebRTC media servers require complex infrastructure (STUN/TURN, SIP trunking, telecom approvals).
2. **External Vector Database Infrastructure:** Deploying standalone vector database clusters (Qdrant/Chroma) increases deployment friction for a relatively small clinic knowledge base (< 100 documents).
3. **Distributed Observability:** Full OpenTelemetry/Jaeger tracing introduces excessive telemetry boilerplate.
4. **Clinical Scope Ambiguity:** Previous wording hinted at "AI emergency diagnosis", which crosses into medical liability and unrealistic machine learning promises.

---

## 2. Decisions & Scope Adjustments

### Decision 2.1: Browser-Based Audio Simulation over WebSockets
- **Decision:** Eliminate PSTN telephony and WebRTC media servers from Phase 0–1 deliverables.
- **Adopted Pattern:** Client captures audio via standard Web Audio API and streams binary PCM audio chunks over bidirectional WebSockets to `services/voice`.
- **Impact:** Preserves 100% of the conversational voice demonstration, low-latency streaming, and barge-in capability, while eliminating carrier costs and NAT traversal headaches.

### Decision 2.2: Integrated Vector Search (`pgvector` / Embedded)
- **Decision:** Do not require a dedicated standalone vector database container.
- **Adopted Pattern:** Utilize PostgreSQL's `pgvector` extension or an embedded in-memory vector store (e.g. Chroma/FAISS) behind the RAG provider abstraction.
- **Impact:** Zero extra container overhead; single backup and migration pipeline in PostgreSQL.

### Decision 2.3: Structured JSON Logging over Distributed Tracing
- **Decision:** Defer OpenTelemetry / Jaeger distributed tracing.
- **Adopted Pattern:** Structured JSON logging to stdout with correlated `session_id` and `trace_id` headers across services.

### Decision 2.4: Rule-Based Predefined Safety Escalation (No Medical Diagnosis)
- **Decision:** Explicitly bound the system as a **clinic operations & customer service assistant**.
- **Adopted Pattern:** The system never performs medical diagnoses or clinical triage. Potentially urgent situations trigger immediate escalation to human personnel based on explicit keyword and pattern rules.

---

## 3. Consequences & Trade-offs

### Positive:
- **100% Demonstrable Within 12 Weeks:** Frees the team to focus on conversational accuracy, Arabic dialect understanding, and deterministic appointment booking.
- **Zero Cloud Infrastructure Cost:** The entire system can run locally on standard developer laptops using Docker Compose.
- **High Architectural Integrity:** All service boundaries, tool contracts, and the zero-direct-DB rule remain strictly preserved.

### Negative / Deferrals:
- Direct telephone dialing (calling from a physical landline or cellular phone) is deferred to future work or an optional post-graduation extension.
