# ADR-001: Adoption of a Modular Monorepo Architecture

- **Status:** Accepted
- **Date:** 2026-10-04
- **Deciders:** Agentic Clinic Team (5 Software Engineering Students & Lead Architect)
- **Consulted:** Project Stakeholders & Faculty Advisors

---

## 1. Context & Problem Statement
The **Agentic Clinic** platform consists of several tightly coupled but domain-distinct components:
- Clinic Backend REST API (deterministic business logic and database persistence)
- AI Agent Orchestrator (conversational state, tool invocation, guardrails)
- RAG Knowledge Service (embeddings and clinic knowledge search)
- Voice Layer (audio streaming, STT, TTS, barge-in detection)
- Shared data schemas, validation logic, and end-to-end integration tests

Our team consists of 5 developers, each operating an AI coding agent on their local machine. We need an architecture and repository structure that maximizes collaboration velocity, enforces explicit contracts, prevents divergence across services, and avoids microservice management overhead.

---

## 2. Decision
We have decided to organize the codebase as a **Modular Monorepo**.

All services (`services/*`), shared data contracts and schemas (`packages/*`), database migrations (`database/*`), documentation (`docs/`), and end-to-end evaluation suites (`tests/*`) reside within a single Git repository.

---

## 3. Rationale & Benefits

1. **Atomic Cross-Service Contracts:**
   When an API endpoint or tool schema evolves, the schema definition (`packages/schemas`), backend implementation (`services/clinic-backend`), and agent caller (`services/ai-agent`) can be updated and verified within a single pull request.
2. **Single Source of Truth for Documentation:**
   Contracts, architecture blueprints, and AI agent constitutions (`AGENTS.md`) live directly alongside the code, guaranteeing that AI agents always have immediate access to up-to-date context.
3. **Simplified Local Development:**
   A single `docker-compose.yml` and unified `.env.example` make it trivial for all 5 team members to spin up the entire system locally without juggling multiple cloned repositories.
4. **Unified CI/CD Pipeline:**
   A single GitHub Actions workflow validates repository structure, contract compliance, and cross-service integration tests consistently.
5. **AI Coding Agent Efficiency:**
   AI agents can easily inspect adjacent contracts, schemas, and tests across services to produce context-aware code without cross-repo blind spots.

---

## 4. Consequences & Mitigations

### Potential Challenges:
- *Risk:* Unintended coupling between services.
  - *Mitigation:* Strict boundary enforcement defined in root and service-level `AGENTS.md` files. Services communicate only via HTTP/REST or shared schema DTOs.
- *Risk:* Git merge conflicts with 5 active developers.
  - *Mitigation:* Strict short-lived feature branch workflow (`feature/*`), granular CODEOWNERS review assignments, and fast pull request turnarounds.
