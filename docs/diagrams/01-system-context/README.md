# 01 - System Context Diagram

## Diagram Preview

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#ffffff', 'primaryTextColor': '#000000', 'primaryBorderColor': '#000000', 'lineColor': '#000000', 'secondaryColor': '#ffffff', 'tertiaryColor': '#ffffff', 'edgeLabelBackground':'#ffffff' }}}%%
flowchart TB
    Patient["Patient / Caller\n(Web & Voice Client)"]
    Staff["Clinic Staff / Receptionist\n(Management Workstation)"]
    Admin["Clinic Administrator\n(System Operations)"]
    
    subgraph SystemBoundary [" Agentic Clinic Platform (System Boundary) "]
        CoreSystem["Agentic Clinic System\n- Conversational AI Orchestrator\n- Voice & Audio Processing Gateway\n- Clinic REST API & Business Logic\n- RAG Knowledge Base\n- Relational Database (PostgreSQL)"]
    end
    
    VoiceService["External Voice / Speech Provider\n(STT / TTS or Realtime Engine)"]
    KnowledgeDocs["Clinic Source Documents\n(Policies, Schedules & FAQs)"]

    Patient <-->|"Voice Streams & Text Chat\n(Bookings, Inquiries, Cancellations)"| CoreSystem
    Staff <-->|"Staff Dashboard\n(Escalated Calls, Schedules, Tickets)"| CoreSystem
    Admin -->|"System Config, Rosters\n& Service Catalogs"| CoreSystem
    CoreSystem <-->|"Audio Frames & Transcripts"| VoiceService
    KnowledgeDocs -->|"Document Ingestion\n(Batch PDF / Markdown)"| CoreSystem
```

---

## Technical Specifications

- **Source File:** [`context-diagram.mmd`](context-diagram.mmd)
- **Purpose:** Establishes the outermost boundary of the Agentic Clinic platform and illustrates external actors, third-party services, and human users.
- **What it Shows:**
  - The central `Agentic Clinic System` boundary encompassing conversational AI, backend APIs, RAG, and database.
  - Three human actor classes: `Patient / Caller`, `Clinic Staff / Receptionist`, and `Clinic Administrator`.
  - External integration touchpoints: `External Voice / Speech Provider` and `Clinic Source Documents`.
- **What it Intentionally Does Not Show:**
  - Internal micro-routing, REST endpoint paths, database tables, or tool invocation chains (detailed in downstream architecture diagrams).
- **Related Documentation:**
  - [System Architecture Blueprint](../../architecture/system-architecture.md)
  - [Product Requirements](../../product/requirements.md)
