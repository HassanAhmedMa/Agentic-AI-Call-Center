# Local Development Setup Guide

> **PROJECT:** Agentic Clinic  
> **CURRENT PHASE:** Phase 1 — Initial public catalog

---

## 1. Prerequisites

Ensure your local development machine has the following tools installed:
- **Git** (2.30+)
- **Python** (3.11 or higher)
- **PostgreSQL 16**, or **Docker & Docker Compose** (v2+) to run it
- Node.js and pnpm/npm are needed for later frontend work, not this backend slice.

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
| `services/clinic-backend` | **Implemented:** FastAPI catalog, migrations, seeds and tests; pip/pyproject setup | Python 3.11+ |
| `services/ai-agent` | **TODO (Phase 1):** Orchestration framework setup | Python 3.11 |
| `services/rag` | **TODO (Phase 1):** Vector DB client & ingestion pipeline | Python 3.11 |
| `services/voice` | **TODO (Phase 1):** Audio stream server / WebSockets | Python / Node.js |
| `packages/schemas` | Public catalog Pydantic DTOs implemented; other DTOs/TypeScript planned | Shared package |

---

## 5. Working with AI Coding Agents

Follow [the backend guide](../../services/clinic-backend/README.md) to install, migrate, seed, run and test this slice. Each teammate uses their own local database; GitHub shares migrations and synthetic data, not live database contents. A shared hosted demo database can be introduced later through the same PostgreSQL connection interface.

When launching an AI coding agent on your local machine:
1. Ensure your agent reads [AGENTS.md](../../AGENTS.md) and the service-specific `AGENTS.md` in your target directory.
2. Confirm the agent operates on a designated `feature/<description>` branch, never on `main`.
3. Verify that the agent runs `python scripts/validate_repo.py` before you commit.


## ADR-003 local verification setup

`docker compose up -d database redis mailpit` starts development dependencies. Open Mailpit at http://localhost:8025; SMTP is localhost:1025 for a host process or mailpit:1025 for a backend container. Local Mailpit captures messages; it does not send to personal inboxes. For a mobile demo, provide controlled access to the synthetic inbox or configure a real SMTP adapter; never publish Mailpit through the public app tunnel.

Generate separate random service and OTP-HMAC secrets in an ignored local `.env`. The backend must reject placeholder/empty secrets before exposure. Leave `TRUSTED_PROXIES` empty until a specific proxy is configured. Only explicitly trusted ingress may set forwarded IPs. Use real email challenges in development; CI's mock provider is restricted to seeded test accounts and refuses other environments.

Phase 1 needs the minimal browser text/form page before its end-to-end acceptance; the full dashboard is later. Follow [implementation-roadmap.md](implementation-roadmap.md).
