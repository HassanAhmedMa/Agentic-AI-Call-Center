# Phase 0 Architecture Feasibility Audit & Technology Realism Review

> **PROJECT:** Agentic Clinic  
> **DOCUMENT:** Architectural Feasibility & Technology Audit  
> **AUDIT SCOPE:** Graduation Project (5 Software Engineering Students, 12-Week Execution Window)  
> **STATUS:** Complete & Approved

---

## 1. Executive Summary & Audit Mandate

The primary mission of **Agentic Clinic** is to deliver a reliable, demonstrable, and safe conversational customer-service platform for clinic operations. 

In university graduation projects, the most common mode of failure is **premature over-engineering**: accumulating complex distributed components (WebRTC media servers, SIP telephony, distributed tracing, Kubernetes, multi-agent swarms) that consume implementation time without improving the core clinical workflow demonstration.

This audit evaluates all planned architectural components against a strict feasibility criterion:
> *"Can five university software engineering students realistically implement, integrate, test, and demonstrate this within approximately 12 weeks?"*

### Classification Scale:
- **GREEN (High Feasibility):** Solid architectural choice, appropriate for the timeline, low delivery risk.
- **YELLOW (Medium Feasibility / Proceed with Caution):** Feasible, but requires scope discipline, simplified implementation, or benchmarking before commitment.
- **RED (Low Feasibility / Unrealistic):** Too complex, costly, or operationally risky for a 12-week timeline. Must be simplified or replaced with a realistic alternative.

---

## 2. Comprehensive Component Feasibility Evaluation

| # | Architectural Component | Feasibility | Risk Assessment | Recommended Decision & Action | Timeline |
| :- | :--- | :---: | :--- | :--- | :--- |
| **1** | **Modular Monorepo** | **GREEN** | Low risk. Consolidates schemas, documentation, tests, and code. | Retain as decided in ADR-001. Enforce strict directory boundaries. | Immediate |
| **2** | **PostgreSQL Relational DB** | **GREEN** | Low risk. Standard, ACID-compliant, robust indexing for schedule conflicts. | Use PostgreSQL 16+ via async SQLAlchemy and asyncpg. | Immediate |
| **3** | **REST Backend (FastAPI)** | **GREEN** | Low risk. Fast, type-safe (Pydantic), automatic OpenAPI docs. | Implement deterministic business logic and conflict prevention. | Phase 1 |
| **4** | **AI Agent Orchestration** | **GREEN** | Medium risk if prompt design is unstructured. | Keep orchestration deterministic. LLM selects tools via typed schemas. | Phase 1 |
| **5** | **LangGraph / Workflow Engine** | **YELLOW** | Risk of graph over-engineering and complex cyclic state loops. | **Requirement:** Stateful workflow. **Candidate:** LangGraph or lightweight Python state machine. Keep state graph linear and simple. | Phase 1 |
| **6** | **RAG for Clinic Knowledge** | **GREEN** | Low risk if scope is limited to verified clinic policies and FAQs. | Retain as read-only informational context. No database mutations via RAG. | Phase 1 |
| **7** | **Dedicated Vector DB (Qdrant/Chroma)** | **YELLOW** | Running and maintaining a standalone vector database cluster adds ops overhead. | **Requirement:** Semantic retrieval. **Candidate:** Use `pgvector` extension inside PostgreSQL or an in-memory FAISS/Chroma store to eliminate extra infrastructure. | Phase 1 |
| **8** | **Redis Cache & Session Store** | **YELLOW** | Adds another container dependency for local dev and hosting. | **Requirement:** Session state storage. **Candidate:** Use Redis if containerized, or allow fallback to PostgreSQL session table for minimal local dev setup. | Phase 1 |
| **9** | **Realtime Voice API** | **YELLOW** | High per-minute cost; variable support for Egyptian Arabic idioms; latency unpredictability. | **Requirement:** Real-time voice interaction. **Candidate:** Benchmark alongside Cascaded STT-Agent-TTS pipeline. | Phase 1 |
| **10** | **Speech-to-Text (STT)** | **GREEN** | Low risk via managed API (Groq Whisper / OpenAI Whisper) with strong Arabic support. | Stream chunked audio to Whisper endpoint. | Phase 1 |
| **11** | **Text-to-Speech (TTS)** | **GREEN** | Low risk via ElevenLabs / Azure Speech Arabic neural voices. | Stream audio chunks back to browser client. | Phase 1 |
| **12** | **Cascaded Pipeline (STT➔Agent➔TTS)** | **GREEN** | Highest predictability, easy to mock, modular debugging, robust dialect support. | Set as primary baseline for development; benchmark against Realtime API. | Immediate |
| **13** | **WebSockets for Audio Streaming** | **GREEN** | Standard browser/server duplex streaming for PCM audio chunks. | Use FastAPI WebSocket endpoint for audio transport. | Phase 1 |
| **14** | **WebRTC Media Server** | **RED** | Extreme complexity: requires ICE/STUN/TURN infrastructure, SDP signaling, and media server ops. | **REMOVE WebRTC requirement.** Replace with standard WebSocket audio streaming. | Immediate (ADR-002) |
| **15** | **PSTN / Telephony (Twilio / SIP)** | **RED** | High financial cost, Egyptian telecom regulatory hurdles, complex SIP trunking. | **REMOVE live telephony requirement.** Provide browser-based call simulator widget for live demo. | Immediate (ADR-002) |
| **16** | **Conversation-bound Authentication** | **GREEN** | Standard token-based auth for patient/staff sessions. | ADR-003 proposes opaque conversation tokens and backend patient-session bindings; email OTP from Phase 1, no patient token in model context. Staff auth is specified separately. | Phase 1 |
| **17** | **Role-Based Authorization (RBAC)** | **YELLOW** | Risk of over-complicating permissions with granular matrices. | Simplify to 2 roles: `patient` and `clinic_staff`. Enforced strictly at the REST API layer. | Phase 1 |
| **18** | **API Versioning** | **GREEN** | Minimal overhead. Standard `/api/v1` URL prefix. | Adopt as standard. | Immediate |
| **19** | **Controlled Tool Calling** | **GREEN** | Core architectural foundation. Protects DB from LLM hallucination. | 19 state-filtered tools, with deterministic propose/confirm execution and explicit API DTO mapping. | Immediate |
| **20** | **Session State Management** | **GREEN** | Bounded dialogue history and active slot memory. | Keep session memory limited to active booking intent and last 10 turns. | Phase 1 |
| **21** | **Human Escalation / Handoff** | **GREEN** | High value for clinical safety and project demonstration. | Deliver as a Truthful unavailable fallback in Phase 1; authenticated reception queue contract and implementation in Phase 2. | Phase 2 |
| **22** | **Evaluation Framework** | **YELLOW** | Risk of spending weeks building custom evaluation harnesses. | Use an offline Python evaluation script with 50 curated synthetic test transcripts. | Phase 1 |
| **23** | **Distributed Observability (OTel/Jaeger)**| **RED** | Massive overhead configuring OpenTelemetry collectors and tracing collectors. | **REMOVE distributed tracing.** Use structured JSON logging to stdout with correlated `trace_id`. | Immediate (ADR-002) |
| **24** | **Docker & Docker Compose** | **GREEN** | Standardizes local development environment for 5 students. | Maintain lightweight `docker-compose.yml` for PostgreSQL, Redis and local Mailpit. | Immediate |
| **25** | **CI/CD Automation** | **GREEN** | Essential for preventing regressions when 5 students merge code. | Automated linting, repo validation, and unit tests on GitHub Actions. | Immediate |

---

## 3. High-Risk Items Detailed Analysis (RED & YELLOW Items)

### 3.1. Telephony (PSTN/SIP) & WebRTC (Classified: RED ➔ Scope Cut)
- **Problem:** Integrating true PSTN phone lines via Twilio or local Egyptian telecom operators requires commercial enterprise accounts, phone number leasing, SIP trunk configuration, and NAT traversal (STUN/TURN). This would easily consume 4–6 weeks of student engineering time with zero clinical AI benefit.
- **Remediation:** Replace with a **Browser-Based Audio Calling Interface**. The client captures microphone audio via standard Web Audio API and streams binary PCM chunks over WebSockets to `services/voice`. This completely demonstrates the real-time conversational voice experience without telephony overhead.

### 3.2. Dedicated Vector Database Clusters (Classified: YELLOW ➔ Simplified)
- **Problem:** Running dedicated distributed vector databases (e.g. Qdrant cloud/cluster) introduces unnecessary operational maintenance and network hops.
- **Remediation:** The clinic knowledge base contains fewer than 100 documents (policies, FAQ, doctor bios). For this scale, `pgvector` inside our existing PostgreSQL instance or a local embedded vector store (Chroma/FAISS) delivers sub-millisecond retrieval with zero extra cloud infrastructure.

### 3.3. Distributed Observability Stack (Classified: RED ➔ Simplified)
- **Problem:** Setting up OpenTelemetry collectors, Jaeger, Prometheus, and Grafana is disproportionate for a university graduation project.
- **Remediation:** Standardized structured JSON logging with a propagated `session_id` and `trace_id`. This allows full trace inspection using standard log filtering.

### 3.4. Medical Scope & Safety Realism
- **Problem:** Earlier drafts mentioned "identifies medical emergencies" or "clinical safety triage". An AI customer-service system must not claim to provide medical diagnosis.
- **Remediation:** All safety escalations are explicitly defined as **predefined keyword/pattern safety rules** triggering immediate non-clinical escalation to human clinic staff.

---

## 4. Architectural Requirements vs. Implementation Candidates

To avoid premature lock-in, the team distinguishes strict requirements from tentative implementations:

| Architectural Requirement | Implementation Candidate (Phase 0 Baseline) | Pluggable Alternative |
| :--- | :--- | :--- |
| **Relational Persistence** | PostgreSQL 16+ via SQLAlchemy Async | Any ANSI SQL Relational DB |
| **Real-time Audio Transport** | WebSocket binary audio streaming | WebRTC Data Channel |
| **Speech-to-Text (STT)** | OpenAI Whisper API / Groq Whisper | Local Whisper / Azure STT |
| **Text-to-Speech (TTS)** | ElevenLabs / Azure Speech Neural Arabic | OpenAI TTS |
| **Vector Search** | `pgvector` extension in PostgreSQL | Qdrant / Chroma / FAISS |
| **LLM Orchestration** | Structured Function Calling via OpenAI/Anthropic/Gemini | Local Ollama/vLLM model |
| **Dialogue State Engine** | Lightweight Finite State Machine / LangGraph | Custom async event graph |
