# 06 - Component Diagram

This directory contains the UML Component Diagram modeling service decoupling, structural dependencies, interfaces, and the controlled execution barrier.

---

## Diagram Preview

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#ffffff', 'primaryTextColor': '#000000', 'primaryBorderColor': '#000000', 'lineColor': '#000000', 'secondaryColor': '#ffffff', 'tertiaryColor': '#ffffff', 'edgeLabelBackground':'#ffffff' }}}%%
flowchart TB
    subgraph ClientComponent [" [Component] Client Interface Tier "]
        WebUI["Web Browser App\n(Next.js / HTML5 Web Audio API)"]
    end

    subgraph VoiceComponent [" [Component] Voice Gateway Service (services/voice) "]
        WS_Server["WebSocket Audio Gateway"]
        VoiceAdapter["«interface» VoiceProvider Adapter"]
        WS_Server --> VoiceAdapter
    end

    subgraph ExternalVoice [" [External System] Voice Providers "]
        ExtProvider["STT / TTS or Realtime Voice APIs\n(Whisper / ElevenLabs / Gemini Live)"]
    end
    VoiceAdapter <-->|"Audio / Text Events"| ExtProvider

    subgraph AgentComponent [" [Component] AI Agent Orchestration (services/ai-agent) "]
        DialogueManager["Dialogue Manager & Context Store"]
        NLU["Intent & Slot Classifier (AR / EN)"]
        ToolDispatcher["Controlled Tool Dispatcher"]
        
        DialogueManager <--> NLU
        DialogueManager --> ToolDispatcher
    end

    subgraph RAGComponent [" [Component] RAG Knowledge Service (services/rag) "]
        Retriever["Knowledge Retriever & Embedder"]
        KnowledgeStore[("Knowledge Store / Vector Index\n(pgvector in PostgreSQL / Embedded Store)")]
        Retriever <--> KnowledgeStore
    end

    subgraph BackendComponent [" [Component] Clinic Backend REST Service (services/clinic-backend) "]
        RESTControllers["REST API Controllers (/api/v1)"]
        AuthModule["Auth & Session Token Validator"]
        DomainServices["Clinical Domain Services\n(Appointments, Doctors, Patients, Tickets)"]
        ORM["Data Access Layer (SQLAlchemy Async)"]
        
        RESTControllers --> AuthModule
        AuthModule --> DomainServices
        DomainServices --> ORM
    end

    subgraph PersistenceComponent [" [Component] Relational Persistence Tier (database/) "]
        PostgresDB[("PostgreSQL 16+ Database\n(ACID Relational Storage)")]
    end

    WebUI <-->|"Duplex WebSocket (Binary Audio)"| WS_Server
    WebUI <-->|"HTTPS REST / WSS (Chat & UI State)"| DialogueManager

    VoiceAdapter <-->|"Transcribed Events / Speech Requests"| DialogueManager
    
    DialogueManager <-->|"Informational Queries / Grounded Chunks"| Retriever

    ToolDispatcher -->|"Strict Tool JSON Payloads (REST API)"| RESTControllers
    ORM -->|"asyncpg Connection Pool"| PostgresDB

    DialogueManager -.-x|"❌ ZERO DIRECT SQL ACCESS"| PostgresDB
    Retriever -.-x|"❌ ZERO MUTATION ACCESS"| PostgresDB
```

- **Source File:** [`component-diagram.mmd`](component-diagram.mmd)
- **Key Takeaway:** Formally anchors the structural dependencies:
  1. `AI Agent` depends strictly on `Tool Dispatcher`, which communicates with `Clinic Backend` via documented REST APIs.
  2. The LLM has zero direct link to `PostgreSQL`.
  3. `RAG Knowledge Service` is isolated from the transactional database and performs read-only semantic searches.
