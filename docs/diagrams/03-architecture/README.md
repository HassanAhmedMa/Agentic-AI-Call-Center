# 03 - Architecture & Workflow Diagrams

This directory contains architectural blueprints and runtime workflow diagrams illustrating subsystem relationships, agent state machines, and voice audio streaming.

All diagrams are rendered with an **opaque solid white canvas** for high-contrast viewing on both dark and light modes.

---

## 1. Subsystem Architecture & Boundary Diagram

![Subsystem Architecture](architecture-subsystems.svg)

- **Vector Image:** [`architecture-subsystems.svg`](architecture-subsystems.svg)
- **High-Res PNG:** [`architecture-subsystems.png`](architecture-subsystems.png)
- **Source File:** [`architecture-subsystems.mmd`](architecture-subsystems.mmd)
- **Purpose:** Clarifies layer responsibilities and visually reinforces the zero-direct-database access rule (`LLM ➔ Tools ➔ Backend API ➔ Database`).

---

## 2. AI Agent Control Flow & Workflow Diagram

![AI Agent Workflow](ai-agent-workflow.svg)

- **Vector Image:** [`ai-agent-workflow.svg`](ai-agent-workflow.svg)
- **High-Res PNG:** [`ai-agent-workflow.png`](ai-agent-workflow.png)
- **Source File:** [`ai-agent-workflow.mmd`](ai-agent-workflow.mmd)
- **Purpose:** Models the complete internal control graph of the conversational orchestrator, showing safety rule checks, slot clarification, confirmation prompts, tool error recovery, and human handoff.

---

## 3. Conceptual Voice Flow & Barge-in Diagram

![Voice Flow](voice-flow-conceptual.svg)

- **Vector Image:** [`voice-flow-conceptual.svg`](voice-flow-conceptual.svg)
- **High-Res PNG:** [`voice-flow-conceptual.png`](voice-flow-conceptual.png)
- **Source File:** [`voice-flow-conceptual.mmd`](voice-flow-conceptual.mmd)
- **Purpose:** Details audio packet ingress, strategy routing between Candidate A (Realtime) and Candidate B (Cascaded), and immediate audio buffer truncation upon user barge-in (< 50ms).
- **Related Documentation:**
  - [Voice Architecture Contract](../../architecture/voice-architecture.md)
  - [Feasibility Audit (Section 2: Voice)](../../architecture/feasibility-audit.md)
