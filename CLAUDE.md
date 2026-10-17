# Agentic Clinic - AI Agent Constitution & Developer Rules

Refer to `AGENTS.md` and `.cursorrules` for the primary repository constitution.

## Multi-Developer Localhost & Backend Protocol (Hassan, Ziad, Ali, Omar):
1. **Localhost-First:** All changes must run and test locally on `localhost` / `127.0.0.1` (ports 5500, 5501, 8000, 8002). Never break local testing with production-only origin/cookie restrictions.
2. **Server Non-Interference:** Never change shared server ports or container configurations without coordinating with teammates.
3. **Detailed Backend Commits:** Every backend or container commit must detail modified endpoints, container runtime impacts, and instructions for teammates.
4. **Test Verification:** Run `pytest tests/unit/` and `node --test tests/frontend/*.test.cjs` before committing.
