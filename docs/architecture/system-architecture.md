# System Architecture

> **PROJECT:** Agentic Clinic  
> **DOCUMENT:** System Architecture Blueprint  
> **PHASE:** Phase 0 — Foundation & Contracts

---

## 1. High-Level Architecture Overview

The **Agentic Clinic** platform is organized as a modular, contract-driven monorepo designed for high reliability, low conversational latency, and clinical safety.

```
                    ┌─────────────────────────┐
                    │      User / Caller      │
                    └────────────┬────────────┘
                                 │
                         Voice / Text Input
                                 │
                    ┌────────────▼────────────┐
                    │       Voice Layer       │
                    │  (STT, TTS, Streaming)  │
                    └────────────┬────────────┘
                                 │ Text & Audio Events
                    ┌────────────▼────────────┐
                    │        AI Agent         │
                    │      Orchestration      │
                    │  (State, Intent, Tools) │
                    └───────┬──────────┬──────┘
                            │          │
                     Tools  │          │ RAG
                  Execution │          │ Retrieval
                            │          │
                 ┌──────────▼─┐     ┌──▼──────────┐
                 │   Clinic   │     │  Knowledge  │
                 │  Backend   │     │ Base (RAG)  │
                 │  REST API  │     └─────────────┘
                 └──────┬─────┘
                        │ SQL (Internal Only)
                 ┌──────▼─────┐
                 │ PostgreSQL │
                 │  Database  │
                 └────────────┘
```

---

## 2. Fundamental Architectural Rule: Zero Direct Database Access

```
[LLM] ──❌ NEVER ──► [Database]
[LLM] ──► [Tool] ──► [Clinic Backend REST API] ──► [Database]
```

Under no circumstances does the AI Agent, LLM, or RAG retriever communicate directly with the database.
- The **LLM** is an untrusted agent proposing actions.
- **Tools** format the LLM's requests into validated API payloads.
- The **Clinic Backend REST API** enforces authentication, authorization, business rules, conflict resolution, and transactional database integrity.

---

## 3. Subsystem Responsibilities & Boundaries

### 3.1. Voice Layer (`services/voice`)
- **Role:** Bridges audio streams between the user and the system.
- **Key Responsibilities:**
  - Manages real-time audio input/output via browser WebSockets (ADR-002).
  - Performs Speech-to-Text (STT) and Text-to-Speech (TTS) through a pluggable `VoiceProvider` interface.
  - Detects caller interruption (barge-in) and immediately halts outgoing audio.
  - Supports English, Modern Standard Arabic (MSA), and Egyptian Arabic phonetics.
- **Boundaries:** Does **not** perform business logic or conversational decisions. Emits transcribed events to the AI Agent and streams back synthesized audio.

### 3.2. AI Agent Orchestrator (`services/ai-agent`)
- **Role:** Maintains conversational context, manages turn-taking, classifies intents, and decides tool invocations.
- **Key Responsibilities:**
  - Disambiguates user utterances in Arabic, Egyptian dialect, and English.
  - Evaluates whether user requests require informational answers (via RAG) or actions (via Tools).
  - Collects required slot arguments (e.g., date, doctor specialty) before proposing tool calls.
  - Requests explicit confirmation for state-altering actions (e.g., booking or cancelling an appointment).
- **Boundaries:** Does **not** execute SQL queries, bypass backend APIs, or store persistent clinical records.

### 3.3. RAG / Knowledge Base (`services/rag`)
- **Role:** Supplies verified clinical and administrative knowledge to the AI agent.
- **Key Responsibilities:**
  - Ingests verified clinic policies, operating hours, preparation guidelines, and doctor biographies.
  - Executes semantic search against a vector store using dense embeddings.
  - Returns retrieved text chunks, source attribution, and relevance scores.
- **Boundaries:** **Read-only**. RAG never performs mutations, never books appointments, and never authorizes users.

### 3.4. Clinic Backend API (`services/clinic-backend`)
- **Role:** Authoritative business logic engine and database gateway.
- **Key Responsibilities:**
  - Exposes RESTful endpoints defined in `docs/architecture/api-contracts.md`.
  - Enforces schedule constraints (e.g., preventing double-booking, verifying doctor working hours).
  - Manages patient accounts, doctor rosters, appointments, services, and support tickets.
  - Issues opaque conversation tokens, binds server-side verified patient sessions, and validates service authentication plus patient ownership (ADR-003).
- **Boundaries:** Completely decoupled from the LLM. Operates as a standard, secure web API that could serve web, mobile, or third-party consumers.

### 3.5. Persistence Layer (`database/`)
- **Role:** ACID-compliant relational storage.
- **Technology:** PostgreSQL 16+.
- **Boundaries:** Accessible exclusively by `services/clinic-backend`. Direct connections from outside the backend network are strictly prohibited.

---

## 4. Communication Protocols & Interfaces

| Source | Destination | Protocol / Interface | Contract Reference |
| :--- | :--- | :--- | :--- |
| User Client | Voice Layer | Browser WSS audio / HTTPS forms | `docs/architecture/voice-architecture.md` |
| Voice Layer | AI Agent | Async Event Bus / Internal HTTP / WS | `docs/architecture/voice-architecture.md` |
| AI Agent | Tools | Structured Function Calling | `docs/architecture/tool-schemas.md` |
| Tools | Clinic Backend | HTTP/1.1 REST (JSON) | `docs/architecture/api-contracts.md` |
| AI Agent | RAG Service | Internal HTTP REST | `docs/architecture/rag-contract.md` |
| Clinic Backend | Database | PostgreSQL Wire Protocol (TCP 5432) | `docs/architecture/database-schema.md` |

---

## 5. Security & Failure Domains

1. **Isolation of Failures:** A failure in speech recognition or RAG retrieval does not crash the clinic backend. The agent falls back to asking the user to repeat or transfers to human support.
2. **Deterministic Fallbacks:** When the LLM generates an invalid tool call or encounters a backend 4xx/5xx error, the error is parsed deterministically and explained naturally to the user.
3. **Session Expiry & Data Minimization:** Audio buffers are processed in memory and not permanently retained on disk. No real patient data is permitted in the system.

The browser submits registration forms and email codes directly to the clinic backend; they bypass the voice and agent services. See ADR-003 and [implementation-roadmap.md](../development/implementation-roadmap.md) for proposed identity changes and phase gates.
