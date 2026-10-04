# AI Agent Orchestrator Service (`services/ai-agent`)

The conversational intelligence core of Agentic Clinic.

## Architecture Status
- **Current Phase:** Phase 0 (Foundation & Contracts)
- **Tool Schemas:** [docs/architecture/tool-schemas.md](../../docs/architecture/tool-schemas.md)
- **Data Flow Blueprint:** [docs/architecture/data-flow.md](../../docs/architecture/data-flow.md)
- **Evaluation Plan:** [docs/evaluation/evaluation-plan.md](../../docs/evaluation/evaluation-plan.md)

## Key Invariants
- **Zero Direct DB Access:** The agent interacts with clinic state strictly by invoking approved tools that call the Clinic Backend REST API.
- **Multilingual Support:** Supports English, Modern Standard Arabic (MSA), and Egyptian Arabic dialect.
- **Confirmation Guardrails:** Requires explicit user verification before confirming bookings or cancellations.
