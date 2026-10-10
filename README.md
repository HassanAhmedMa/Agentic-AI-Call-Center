# Agentic Clinic

[![Phase: Phase 1 Catalog](https://img.shields.io/badge/Phase-1%20Public%20Catalog-blue.svg)](services/clinic-backend/README.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Architecture: Modular Monorepo](https://img.shields.io/badge/Architecture-Modular%20Monorepo-orange.svg)](docs/decisions/ADR-001-monorepo.md)

An intelligent, voice- and text-enabled conversational customer-service system demonstrated through a simulated clinic environment. Designed and engineered as a university graduation project by a team of five software engineering students working concurrently with AI coding agents.

---

## 🏥 Project Overview

Agentic Clinic delivers a reliable, natural, and low-latency conversational experience for clinic operations. The agent assists patients with:
- **Doctor Search & Profiling:** Finding specialists by discipline, availability, and profile information.
- **Appointment Management:** Viewing, booking, rescheduling, and cancelling appointments with strict conflict checks.
- **Service & Pricing Information:** Providing accurate details on clinic examinations, treatments, and operational policies.
- **Support & Ticketing:** Creating and tracking customer support tickets for non-clinical inquiries.
- **Human Escalation:** Graceful handoff to human support representatives whenever clinical ambiguity or user frustration arises.
- **Multilingual Support:** English, Modern Standard Arabic (MSA), Egyptian Arabic (العامية المصرية), and Arabic-English code-switching.

---

## 🏛️ Architectural Principle: Zero Direct DB Access

```
User / Caller ──► Voice/Text Interface ──► Voice Processing ──► AI Agent Orchestration
                                                                     │          │
                                                             Tools   ▼          ▼ RAG
                                                       Clinic Backend API   Knowledge Base
                                                                     │
                                                           PostgreSQL DB
```

> ⚠️ **Core Invariant:**  
> The Large Language Model (LLM) **NEVER directly accesses the database**.  
> The LLM acts purely as a reasoning and orchestration layer, proposing actions via **strictly typed, approved tools**. Tools communicate with the **Clinic Backend REST API**, which deterministically validates business rules, permissions, and time-slot constraints.

---

## 📂 Repository Structure

```
agentic-clinic/
├── .github/                 # Workflows (CI/CD), issue templates, PR template, CODEOWNERS
├── docs/                    # Architecture blueprints, API contracts, tool schemas, product specs
│   ├── architecture/        # System design, REST API contracts, tool schemas, data flows, DB schema
│   ├── decisions/           # Architectural Decision Records (ADRs)
│   ├── development/         # Developer setup, Git workflow, coding standards, testing strategy
│   ├── product/             # Functional scope, requirements, UI/UX design system guidelines
│   └── evaluation/          # Evaluation plans and benchmark categories (accuracy, latency, safety)
├── services/
│   ├── clinic-backend/      # Deterministic clinic REST API (business rules & persistence)
│   ├── ai-agent/            # Agent orchestrator, state management, tool invocation
│   ├── rag/                 # RAG retrieval service for clinic knowledge base
│   └── voice/               # Voice gateway & streaming audio interface (VoiceProvider abstraction)
├── packages/
│   ├── schemas/             # Shared schema definitions (Pydantic / TypeScript DTOs)
│   ├── shared/              # Common utilities, constants, custom errors
│   ├── config/              # Centralized environment configuration
│   └── logging/             # Structured logging and telemetry
├── database/
│   ├── migrations/          # Database migration files
│   └── seed/                # Deterministic synthetic clinic test data
├── tests/
│   ├── integration/         # Inter-service integration tests
│   ├── e2e/                 # Full conversation & booking end-to-end tests
│   └── evaluation/          # LLM evaluation test suites (NLU, Arabic dialect, safety)
├── scripts/                 # Maintenance, linting, and repo validation tools
├── AGENTS.md                # Operating constitution for AI coding agents
├── CONTRIBUTING.md          # Contribution guidelines and Git workflow for human team
├── docker-compose.yml       # Local dev persistence & future service topology
├── .env.example             # Safe template for environment variables
├── .gitignore               # Ignored files (Python, Node, OS, logs, secrets)
└── LICENSE                  # MIT License
```

---

## 🚦 Current Status: Phase 1 — Catalog, Conversations and Identity

The first Phase 1 slice implements public doctor/service discovery:

Conversation creation and service-authenticated lifecycle are now implemented
locally. See [conversation review notes](docs/development/phase1-conversation-changes.md).
Registration, SMTP verification and bilingual forms now exist locally.
See [identity review notes](docs/development/phase1-identity-changes.md).

- ✅ FastAPI backend, three catalog tables, Alembic migrations and deterministic synthetic seeds.
- ✅ English/Egyptian Arabic catalog data and normalized Arabic/English doctor search.
- ✅ Health/readiness endpoints, typed public contracts and PostgreSQL integration tests.
- ✅ Identity endpoints and English/Egyptian Arabic registration page; local Mailpit email testing.
- ⏳ Availability, appointments, agent tools, RAG and voice remain planned.
- ❌ No production speech recognition or voice pipelines are hooked up.
- ✅ All architectural boundaries, REST contracts, AI tool schemas, and database entity relationships are formalized and documented.
- ✅ The monorepo layout, Git conventions, CI pipeline foundation, and AI agent constitutions are in place.

---

## 👥 How We Work: Humans + AI Coding Agents

Our team consists of 5 software engineering students. Each developer works with an AI coding agent on their local machine. To prevent collisions and ensure quality:
1. **Contracts First:** Development proceeds against explicit contracts (`docs/architecture/api-contracts.md` and `docs/architecture/tool-schemas.md`).
2. **Read `AGENTS.md`:** Every AI agent must read [AGENTS.md](AGENTS.md) before writing code.
3. **No Direct Commits to `main`:** All work happens on task-specific branches (`feature/*`, `fix/*`, `refactor/*`).
4. **Human Review Required:** AI-generated code is untrusted until reviewed by at least one human teammate.
5. **No Secrets:** Never commit real credentials or real patient information. Use `.env` locally.

For detailed guidelines, see [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md).

For runnable backend setup, including Docker and team development, see [the backend guide](services/clinic-backend/README.md).

---

## 🚀 Getting Started

To explore the architecture and prepare your local environment, consult:
- [System Architecture](docs/architecture/system-architecture.md)
- [Clinic API Contracts](docs/architecture/api-contracts.md)
- [AI Tool Schemas](docs/architecture/tool-schemas.md)
- [Database Schema Blueprint](docs/architecture/database-schema.md)
- [Local Development Setup](docs/development/setup.md)
- [Git Workflow](docs/development/git-workflow.md)

## ADR-003 review and next implementation step

Identity/booking decisions remain **Proposed** pending the recorded approval gates. Read the [review findings](docs/development/architecture-review-2026-10-10.md) and [implementation roadmap](docs/development/implementation-roadmap.md). Phase 1 targets deterministic backend identity and a minimal browser text/form page; currently the backend implements catalog, conversations and patient identity.
