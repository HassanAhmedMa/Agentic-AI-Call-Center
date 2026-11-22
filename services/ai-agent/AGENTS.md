# AGENTS.md - AI Agent Orchestrator Guidelines for AI Coding Agents

> **SERVICE:** `services/ai-agent`  
> **DOMAIN:** Conversational State, Intent Recognition, Guardrails & Tool Calling  
> **TOOL SCHEMAS REFERENCE:** [docs/architecture/tool-schemas.md](../../docs/architecture/tool-schemas.md)  
> **SYSTEM ARCHITECTURE:** [docs/architecture/system-architecture.md](../../docs/architecture/system-architecture.md)

---

## 1. Service Responsibilities

The AI Agent orchestrator is the reasoning core of the simulated clinic assistant.
- Interprets caller utterances across English, MSA, and Egyptian Arabic.
- Maintains multi-turn conversation state and session context.
- Invokes approved tools according to schemas defined in `docs/architecture/tool-schemas.md`.
- Uses `propose_booking`, `propose_cancellation`, `propose_reschedule` and `propose_ticket`, then `confirm_pending_action` after delivered summary and a new affirmative caller turn.
- Uses `services/rag` for informational clinic inquiries.
- Requests escalation (truthfully reports unavailable/queued/connected state) (`transfer_to_human`) for medical emergencies or on patient demand.

---

## 2. Inviolable Architectural Rules for AI Agents

1. **NO DIRECT DATABASE ACCESS:**
   - **Never import database drivers, ORM models, or connection strings into this service.**
   - All state mutations must occur strictly through approved tools invoking `services/clinic-backend` REST endpoints.
2. **Strict Tool Schemas:**
   - Tools must match `docs/architecture/tool-schemas.md` in name, input parameters, and output contracts.
3. **Confirmation Guardrails:**
   - The deterministic dispatcher enforces the proposal/session/delivery/turn checks and replay lifecycle in tool-schemas §3. The LLM never supplies identity, credentials, OTPs or idempotency keys. Negative or ambiguous answers never authorize execution.
4. **Provider Abstraction:**
   - LLM model invocation must sit behind a clean adapter interface (`LLMProvider`) to ensure seamless model swapping (OpenAI, Anthropic, Google, local models).
5. **No Medical Diagnoses:**
   - The agent must never prescribe medicine, diagnose ailments, or offer medical advice.

---

## 3. Planned Architecture (Phase 1+)

- **Language:** Python 3.11+
- **State Management:** LangGraph or state machine engine backed by Redis session storage.
- **Evaluation:** Offline automated benchmarks via `tests/evaluation/`.
