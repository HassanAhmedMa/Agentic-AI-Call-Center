# Local Development Setup Guide

> **PROJECT:** Agentic Clinic  
> **CURRENT PHASE:** Phase 0 (Architecture & Foundation)

---

## 1. Prerequisites

Ensure your local development machine has the following tools installed:
- **Git** (2.30+)
- **Python** (3.11 or higher)
- **Node.js** (v20+ LTS) & **pnpm** (or npm)
- **Docker & Docker Compose** (v2+)

---

## 2. Initial Repository Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd agentic-clinic
   ```

2. **Configure Environment Variables:**
   ```bash
   # Copy the environment template
   cp .env.example .env
   ```
   *Note: Edit `.env` to supply development credentials. NEVER commit `.env`.*

3. **Verify Repository Structure & Contracts:**
   ```bash
   # Run the repository validation script
   python scripts/validate_repo.py
   ```

---

## 3. Starting Infrastructure Services (Phase 0)

Phase 0 provides the foundational persistence layer (PostgreSQL and Redis) via Docker Compose:

```bash
# Start background PostgreSQL and Redis services
docker compose up -d database redis

# Verify containers are healthy
docker compose ps
```

---

## 4. Workstream Development Status (Phase 1+ TODOs)

| Service | Setup Status | Planned Runtime |
| :--- | :--- | :--- |
| `services/clinic-backend` | **TODO (Phase 1):** FastAPI / Poetry setup | Python 3.11 |
| `services/ai-agent` | **TODO (Phase 1):** Orchestration framework setup | Python 3.11 |
| `services/rag` | **TODO (Phase 1):** Vector DB client & ingestion pipeline | Python 3.11 |
| `services/voice` | **TODO (Phase 1):** Audio stream server / WebSockets | Python / Node.js |
| `packages/schemas` | **TODO (Phase 1):** Pydantic & TypeScript DTO build | Shared package |

---

## 5. Working with AI Coding Agents

When launching an AI coding agent on your local machine:
1. Ensure your agent reads [AGENTS.md](../../AGENTS.md) and the service-specific `AGENTS.md` in your target directory.
2. Confirm the agent operates on a designated `feature/<description>` branch, never on `main`.
3. Verify that the agent runs `python scripts/validate_repo.py` before you commit.
