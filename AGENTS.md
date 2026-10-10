# AGENTS.md - Repository Operating Constitution for AI Coding Agents & Engineers

> **PROJECT:** Agentic Clinic  
> **CURRENT PHASE:** Phase 1 — Public catalog and conversation foundation
> **TARGET AUDIENCE:** All AI coding agents (and human engineers) collaborating on this repository.

---

## 1. Project Overview & Mission

### What the Project Is
**Agentic Clinic** is an enterprise-grade, conversational customer-service AI platform demonstrated through a simulated clinic environment. The system supports patient interaction across **text and real-time voice**, executing safe, controlled clinic operations such as doctor search, availability checks, appointment booking, rescheduling, cancellations, service information retrieval, support ticket issuance, and seamless escalation to human personnel.

### Why It Exists
Healthcare communication requires zero-hallucination guarantees, deterministic execution of business rules, and low-latency interaction in multiple languages:
- **English**
- **Modern Standard Arabic (MSA)**
- **Egyptian Arabic (العامية المصرية)**
- **Arabic-English Code Switching**

### The Core Architectural Tenet
> **THE LLM MUST NEVER DIRECTLY ACCESS THE DATABASE.**  
> The LLM functions strictly within an orchestration layer. It proposes actions by invoking **explicitly typed, controlled tools**. Tools invoke **backend REST APIs**. Backend services enforce all authentication, authorization, transactional integrity, and clinical business constraints.

---

## 2. System Architecture & Flow

```
                      ┌────────────────────────┐
                      │     User / Caller      │
                      └───────────┬────────────┘
                                  │
                             Voice / Text
                                  │
                      ┌───────────▼────────────┐
                      │      Voice Layer       │ (STT / TTS or Realtime Voice Provider)
                      └───────────┬────────────┘
                                  │ Audio/Text Events
                      ┌───────────▼────────────┐
                      │  AI Agent Orchestrator │ (Conversation state, intent, tool selection)
                      └───┬────────────────┬───┘
                          │                │
                  Tool    │                │ Knowledge
               Invocations│                │ Queries
                          │                │
                ┌─────────▼────────┐  ┌────▼──────────────┐
                │  Clinic Backend  │  │  RAG Knowledge    │
                │     REST API     │  │       Base        │
                └─────────┬────────┘  └───────────────────┘
                          │
                ┌─────────▼────────┐
                │ Relational DB /  │
                │   PostgreSQL     │
                └──────────────────┘
```

---

## 3. Strict Architecture Rules

Every AI agent and human engineer must abide by these 14 principles:

1. **Modularity First:** The system is split into cleanly decoupled modules and services.
2. **Explicit Interfaces:** Services communicate exclusively through explicit, documented interfaces (REST/JSON schemas).
3. **No Direct DB Access for LLMs:** LLMs never receive SQL connections, raw ORM models, or direct database credentials.
4. **Controlled Tools Only:** The LLM can only interact with external state via approved tools with strict schema validations.
5. **Typed Input/Output Schemas:** Every tool, API request, and API response must have an explicit JSON Schema / Pydantic / TypeScript type contract.
6. **Backend Business Rule Enforcement:** Backend APIs validate all inputs, invariants, time conflicts, and authorization. Never rely on the LLM to enforce clinic rules.
7. **Deterministic Auth/Authz:** Authentication and authorization must never depend on LLM decisions or prompts.
8. **RAG is Informational Only:** RAG provides contextual knowledge (hours, policies, FAQs). RAG never performs actions, mutates state, or grants authorization.
9. **Explicit Session State:** Session context, conversational memory, and state transitions must be cleanly managed and bounded in structured session storage.
10. **Replaceable Abstractions for External Providers:** LLM models, vector stores, STT/TTS engines, and voice providers must sit behind abstract interfaces (adapters).
11. **Zero Vendor Lock-In:** Never hardcode provider-specific semantics deep inside core business logic.
12. **ADR Requirement:** Never introduce a major architectural change or external dependency without an approved Architectural Decision Record (ADR) in `docs/decisions/`.
13. **No Gratuitous Microservices:** Do not spawn microservices without clear bounded-context justification.
14. **Simple Modules Over Distributed Complexity:** Prefer straightforward modular code over complex distributed systems.

---

## 4. Repository Structure & Boundaries

```
agentic-clinic/
├── .github/                 # CI/CD workflows, issue templates, PR template, CODEOWNERS
├── docs/                    # Architectural contracts, ADRs, product specs, development guides
│   ├── architecture/        # System architecture, API contracts, tool schemas, data flows, DB schema
│   ├── decisions/           # Architectural Decision Records (ADRs)
│   ├── development/         # Setup, Git workflow, coding standards, testing strategy
│   ├── product/             # Clinic functional scope, requirements, UI/UX guidelines
│   └── evaluation/          # Evaluation plans and benchmark categories
├── services/
│   ├── clinic-backend/      # Deterministic clinic REST API & domain business logic
│   ├── ai-agent/            # Orchestrator, conversation management, tool caller
│   ├── rag/                 # Knowledge retrieval service (embeddings & vector search)
│   └── voice/               # Voice gateway & audio streaming adapter (VoiceProvider)
├── packages/
│   ├── schemas/             # Shared data schemas & contracts (API & Tool DTOs)
│   ├── shared/              # Cross-service shared utilities, errors, and constants
│   ├── config/              # Centralized environment & settings configuration
│   └── logging/             # Structured logging and observability utilities
├── database/
│   ├── migrations/          # Schema migration scripts
│   └── seed/                # Deterministic synthetic clinic test/demo data
├── tests/
│   ├── integration/         # Cross-service API & tool integration tests
│   ├── e2e/                 # Full conversation & booking end-to-end flows
│   └── evaluation/          # LLM accuracy, safety, and latency benchmark tests
├── scripts/                 # Developer scripts and repository validation tooling
├── AGENTS.md                # This constitution file
├── README.md                # Project landing documentation
├── CONTRIBUTING.md          # Team contribution guidelines
├── docker-compose.yml       # Local dev persistence & future service topology
├── .env.example             # Configuration variables template (no secrets!)
├── .gitignore               # Ignored files for Python, Node, OS, IDEs, and credentials
└── LICENSE                  # MIT License
```

---

## 5. AI Coding Agent Rules & Boundaries

All AI coding agents operate as **pair-programming assistants**, not autonomous project architects. AI-generated code is treated as untrusted until verified by automated tests and human review.

### What AI Agents MUST Do:
- **Read Before Writing:** Always read the relevant service `AGENTS.md` and `docs/architecture/` files before making changes.
- **Inspect Existing Code:** Examine existing patterns, conventions, and contracts before proposing new files.
- **Maintain Documentation Integrity:** Preserve existing code comments and architectural notes.
- **Strictly Follow Contracts:** Implement code that matches `docs/architecture/api-contracts.md` and `docs/architecture/tool-schemas.md`.
- **Write Tests:** Every new feature, endpoint, or tool must have corresponding unit or integration tests.
- **Run Checks:** Verify that tests, linters, and repository validators pass before finalizing work.
- **Explain Trade-offs:** Document rationale for significant decisions in PR descriptions.
- **Synthetic Data Only:** Use exclusively synthetic demonstration data. Never handle real patient data.

### What AI Agents MUST NOT Do:
- ❌ **NEVER commit secrets, tokens, private keys, or credentials.**
- ❌ **NEVER allow the LLM to directly query the database or execute arbitrary code.**
- ❌ **NEVER bypass backend validation, authentication, or authorization.**
- ❌ **NEVER rewrite unrelated modules or refactor working code outside the task scope.**
- ❌ **NEVER delete working functionality without explicit human approval.**
- ❌ **NEVER introduce new heavy dependencies or architectural patterns without an ADR.**
- ❌ **NEVER invent new API endpoints or tool schemas that contradict documented contracts.**
- ❌ **NEVER develop directly on `main`.**

---

## 6. Git & Branching Strategy

- **`main` is protected and stable.** No direct commits to `main`.
- **Branches represent units of WORK, not individuals.** No personal developer branches.
- **Branch naming convention:**
  - `feature/<short-description>` (e.g., `feature/appointment-booking-api`)
  - `fix/<short-description>` (e.g., `fix/timezone-slot-overlap`)
  - `refactor/<short-description>` (e.g., `refactor/voice-stream-buffer`)
  - `test/<short-description>` (e.g., `test/e2e-cancellation-flow`)
  - `docs/<short-description>` (e.g., `docs/add-arabic-nlu-contract`)
  - `experiment/<short-description>` (e.g., `experiment/realtime-api-latency`)
- **Phase 0 Foundation Branch:** `feature/phase-0-foundation`.

### Conventional Commits
All commit messages must adhere to the Conventional Commits format:
```
<type>: <short imperative summary>

[optional body explaining why and what]

[optional issue reference]
```
Allowed types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `security`.

---

## 7. Testing Strategy

Testing is a first-class citizen of every pull request:
1. **Unit Tests:** Fast, isolated testing of business logic, schema validations, and formatting.
2. **Integration Tests:** Verify tool-to-API communication, database transactions, and error propagation.
3. **End-to-End (E2E) Tests:** Simulated conversation transcripts testing multi-turn booking and edge cases.
4. **Evaluation / Benchmarking:** Quantify intent recognition accuracy, safety filter compliance, and latency metrics across English, MSA, and Egyptian Arabic.

---

## 8. UI / UX Design Principles

When frontend interfaces are created in later phases:
- **Clean Healthcare Aesthetic:** Professional, uncluttered, accessible (WCAG 2.1 AA), with high visual clarity.
- **Design System Tokens:** Strict token usage for typography, spacing, colors, and shadows.
- **Clear Conversational UX:** Real-time feedback for speech recognition, latency indicators, tool execution status, and explicit confirmation dialogs for critical actions (booking/cancellation).

---

## 9. Parallel Development Contracts Matrix

To enable 5 human developers and their AI agents to work concurrently without friction, boundaries are anchored by contracts:

| Workstream | Primary Workspace | Contract Dependency | Mocking Strategy |
| :--- | :--- | :--- | :--- |
| **Clinic Backend** | `services/clinic-backend/` | `docs/architecture/api-contracts.md` | In-memory DB / Seed fixtures |
| **AI Agent** | `services/ai-agent/` | `docs/architecture/tool-schemas.md` | Mocked Clinic REST API client |
| **RAG Knowledge** | `services/rag/` | `docs/architecture/rag-contract.md` | In-memory mock vector store |
| **Voice Layer** | `services/voice/` | `docs/architecture/voice-architecture.md` | Audio file stream mocks / Echo mock |
| **Testing / DevOps**| `tests/`, `.github/`, `scripts/` | All contracts & Schemas | Automated contract validation |

---

## 10. Summary Checklist for Every AI Agent Turn

Before declaring any task complete, ask:
- [ ] Did I read the relevant documentation and contracts first?
- [ ] Did I follow the established repository structure and naming conventions?
- [ ] Are all schemas and contracts preserved and respected?
- [ ] Are all new paths covered by automated tests?
- [ ] Are there zero secrets, keys, or real personal data in my changes?
- [ ] Is my commit message formatted using Conventional Commits?
- [ ] Have I explained the changes clearly to my human pair-programming partner?
