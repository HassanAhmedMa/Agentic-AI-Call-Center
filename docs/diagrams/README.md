# Architecture Visualizations & UML Diagrams Index

> **PROJECT:** Agentic Clinic  
> **DIRECTORY:** `docs/diagrams/`  
> **VISUAL STYLE:** Pure Black & White (No decorative colors, no gradients, high contrast for academic reporting)  
> **TRACEABILITY:** [Requirements Traceability Matrix](requirements-traceability.md)

---

## 1. Master Diagram Index

| Category | Diagram Title | Abstraction Level | Purpose | Source File | Requirements Covered |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **01 System Context** | System Context Diagram | High-Level | Establishes platform perimeter, human actors, and external services | [`01-system-context/context-diagram.mmd`](01-system-context/context-diagram.mmd) | All System Features |
| **02 Use Cases** | System Operations Use Cases (Stickman & Ovals) | High-Level | Maps functional interactions across Patient, Staff, and Administrator | [`02-use-cases/use-case-system.svg`](02-use-cases/use-case-system.svg) <br> ([PUML](02-use-cases/use-case-system.puml) \| [MMD](02-use-cases/use-case-system.mmd)) | REQ-PAT, REQ-DOC, REQ-APP, REQ-SRV, REQ-SUP |
| **02 Use Cases** | AI Agent Conversational Use Cases (Stickman & Ovals) | Conceptual | Details conversational turns, mandatory confirmations, and tool execution | [`02-use-cases/use-case-ai-agent.svg`](02-use-cases/use-case-ai-agent.svg) <br> ([PUML](02-use-cases/use-case-ai-agent.puml) \| [MMD](02-use-cases/use-case-ai-agent.mmd)) | REQ-AI-01 ➔ 09, REQ-ESC-01 |
| **03 Architecture** | Subsystem Architecture & Boundaries | Architectural | Illustrates layers, protocol bindings, and zero-direct-DB-access barrier | [`03-architecture/architecture-subsystems.mmd`](03-architecture/architecture-subsystems.mmd) | REQ-AI-03, REQ-AI-08 |
| **03 Architecture** | AI Agent State Machine & Control Graph | Detailed | Models orchestrator internal control flow, slot clarification, and recovery | [`03-architecture/ai-agent-workflow.mmd`](03-architecture/ai-agent-workflow.mmd) | REQ-AI-02, REQ-AI-05, REQ-AI-07 |
| **03 Architecture** | Conceptual Voice Flow & Barge-in | Implementation | Details audio streaming, VAD, and sub-50ms playback cutoff on interruption | [`03-architecture/voice-flow-conceptual.mmd`](03-architecture/voice-flow-conceptual.mmd) | REQ-AI-01, Voice Architecture |
| **04 Data Models** | Entity-Relationship Diagram (ERD) | Detailed | Exact relational schema, primary/foreign keys, types, and cardinalities | [`04-data/entity-relationship-diagram.mmd`](04-data/entity-relationship-diagram.mmd) | REQ-PAT, REQ-DOC, REQ-APP, REQ-SRV, REQ-SUP |
| **04 Data Models** | Conceptual Domain Class Diagram | Conceptual | Object-oriented representation of domain entities, sessions, and tool calls | [`04-data/domain-class-diagram.mmd`](04-data/domain-class-diagram.mmd) | Domain Model |
| **04 Data Models** | Appointment State Machine | Detailed | Models appointment lifecycle (`scheduled`, `completed`, `cancelled`, etc.) | [`04-data/state-appointment.mmd`](04-data/state-appointment.mmd) | REQ-APP-01 ➔ 06 |
| **04 Data Models** | Support Ticket State Machine | Detailed | Models ticket lifecycle (`open`, `in_progress`, `resolved`, `closed`) | [`04-data/state-support-ticket.mmd`](04-data/state-support-ticket.mmd) | REQ-SUP-01 ➔ 04 |
| **04 Data Models** | DFD Level 1: Conversational Operations | Architectural | Data flow of voice/text input to backend validation and DB updates | [`04-data/dfd-conversation-tools.mmd`](04-data/dfd-conversation-tools.mmd) | REQ-APP-02, REQ-AI-03 |
| **04 Data Models** | DFD: RAG Ingestion & Runtime Search | Implementation | Dual pipeline for document chunking/embedding and runtime semantic search | [`04-data/dfd-rag-ingestion.mmd`](04-data/dfd-rag-ingestion.mmd) | REQ-AI-06, REQ-SRV-02 |
| **05 Sequence** | Appointment Booking (Egyptian Arabic) | Detailed | Temporal trace of dialectal booking, doctor lookup, slot check, and commit | [`05-sequence/seq-appointment-booking.mmd`](05-sequence/seq-appointment-booking.mmd) | REQ-APP-02, REQ-DOC-04, REQ-AI-01 |
| **05 Sequence** | Appointment Cancellation | Detailed | Step-by-step cancellation with mandatory confirmation guardrail | [`05-sequence/seq-appointment-cancellation.mmd`](05-sequence/seq-appointment-cancellation.mmd) | REQ-APP-03, REQ-AI-03 |
| **05 Sequence** | RAG Knowledge Retrieval | Detailed | Temporal message trace for policy and preparation guideline inquiries | [`05-sequence/seq-rag-query.mmd`](05-sequence/seq-rag-query.mmd) | REQ-AI-06, REQ-SRV-02 |
| **05 Sequence** | Predefined Safety Escalation & Handoff | Detailed | Urgent keyword trigger, advisory message, and live queue handoff | [`05-sequence/seq-human-handoff.mmd`](05-sequence/seq-human-handoff.mmd) | REQ-ESC-01, REQ-AI-09 |
| **05 Sequence** | Failed Tool Call & Conflict Recovery | Detailed | PostgreSQL slot conflict detection, rollback, and empathetic recovery | [`05-sequence/seq-tool-call-failure.mmd`](05-sequence/seq-tool-call-failure.mmd) | REQ-APP-05, REQ-AI-04 |
| **05 Sequence** | Voice Audio Stream & Barge-in | Implementation | Real-time audio chunk duplex streaming and sub-50ms queue truncate | [`05-sequence/seq-voice-interaction.mmd`](05-sequence/seq-voice-interaction.mmd) | Voice Architecture |
| **06 Component** | UML Component Diagram | Architectural | Decoupled services, interfaces, dependencies, and zero-direct-DB rule | [`06-component/component-diagram.mmd`](06-component/component-diagram.mmd) | System Architecture |
| **07 Deployment** | Conceptual Deployment Diagram | Implementation | Single-node Docker Compose network with managed cloud API bindings | [`07-deployment/deployment-diagram.mmd`](07-deployment/deployment-diagram.mmd) | Infrastructure Foundation |
| **08 UI** | UI Information Architecture Sitemap | Conceptual | Hierarchical navigation for public patient portal and staff operations desk | [`08-ui/ui-information-architecture.mmd`](08-ui/ui-information-architecture.mmd) | UI/UX Guidelines |

---

## 2. Directory Navigation

- [01-system-context/](01-system-context/)
- [02-use-cases/](02-use-cases/)
- [03-architecture/](03-architecture/)
- [04-data/](04-data/)
- [05-sequence/](05-sequence/)
- [06-component/](06-component/)
- [07-deployment/](07-deployment/)
- [08-ui/](08-ui/)
- [Requirements Traceability Matrix](requirements-traceability.md)
