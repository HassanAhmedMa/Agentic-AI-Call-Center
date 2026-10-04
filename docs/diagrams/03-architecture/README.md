# 03 - Architecture & Workflow Diagrams

This directory contains architectural blueprints and runtime workflow diagrams illustrating subsystem relationships, agent state machines, and voice audio streaming.

---

## 1. Subsystem Architecture & Boundary Diagram

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#ffffff', 'primaryTextColor': '#000000', 'primaryBorderColor': '#000000', 'lineColor': '#000000', 'secondaryColor': '#ffffff', 'tertiaryColor': '#ffffff', 'edgeLabelBackground':'#ffffff' }}}%%
flowchart TD
    Client["Client Tier: Web Application & Voice Audio Gateway\n(Browser Web Audio API / Text Chat Widget)"]
    
    subgraph AudioProcessing [" Voice Processing Tier (services/voice) "]
        VoiceGateway["Voice Gateway (WebSockets Stream Handler)"]
        VoiceProviderInterface["«interface» VoiceProvider Adapter\n(Pluggable Candidate Implementations)"]
        VoiceGateway --> VoiceProviderInterface
    end

    subgraph IntelligenceTier [" Intelligence & Orchestration Tier (services/ai-agent) "]
        AgentOrchestrator["AI Agent Orchestrator\n- Turn Management & Context Tracker\n- Multilingual Intent & Slot Extractor (AR / EN)\n- Safety Rules & Escalation Triage Engine"]
        ToolCaller["Controlled Tool Dispatcher\n(Validates 13 Typed Tool Schemas & User Confirmation)"]
        AgentOrchestrator --> ToolCaller
    end

    subgraph KnowledgeTier [" Grounding Knowledge Tier (services/rag) "]
        RAGRetriever["RAG Retrieval Service\n- Text Chunk Embedder\n- Semantic Similarity Matcher\n- Source Citation Assembler"]
        VectorStore["Knowledge Store / Vector Index\n(pgvector in PostgreSQL OR Embedded Chroma/FAISS)"]
        RAGRetriever --> VectorStore
    end

    subgraph BackendTier [" Deterministic Backend Tier (services/clinic-backend) "]
        ClinicAPI["Clinic Backend REST API (/api/v1)\n- Input Validation (Pydantic DTOs)\n- Authz & Session Token Validation\n- Clinical Business Rules & Slot Conflict Locks"]
    end

    subgraph DataTier [" Relational Persistence Tier (database/) "]
        PostgresDB[("PostgreSQL 16+ Database\n- patients, doctors, appointments\n- services, support_tickets\n- Partial Unique Indexes (Zero Double-Booking)")]
    end

    Client <-->|"Duplex WebSocket (Binary PCM Chunks)"| VoiceGateway
    Client <-->|"HTTPS REST / WebSocket (Text Chat)"| AgentOrchestrator

    VoiceProviderInterface <-->|"Transcribed Utterance / Synthesized Audio"| AgentOrchestrator
    
    AgentOrchestrator <-->|"Informational Queries / Context Chunks"| RAGRetriever
    
    ToolCaller -->|"HTTP REST Calls (JSON Payloads)"| ClinicAPI
    ClinicAPI -->|"SQL Queries & Transactions (asyncpg)"| PostgresDB

    AgentOrchestrator -.-x|"❌ NEVER DIRECTLY ACCESSES"| PostgresDB
```

- **Source File:** [`architecture-subsystems.mmd`](architecture-subsystems.mmd)
- **Purpose:** Clarifies layer responsibilities and visually reinforces the zero-direct-database access rule.

---

## 2. AI Agent State & Workflow Diagram

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#ffffff', 'primaryTextColor': '#000000', 'primaryBorderColor': '#000000', 'lineColor': '#000000', 'secondaryColor': '#ffffff', 'tertiaryColor': '#ffffff', 'edgeLabelBackground':'#ffffff' }}}%%
stateDiagram-v2
    [*] --> Idle: Session Initialized
    
    Idle --> ReceivingInput: User Utterance Arrives (Voice/Text)
    
    state ReceivingInput {
        [*] --> TranscribeAudio: If Voice Input
        TranscribeAudio --> ExtractIntent: Text Ready
        [*] --> ExtractIntent: If Direct Text
    }

    ReceivingInput --> EvaluatingSafety: Utterance Preprocessed
    
    state EvaluatingSafety <<choice>>
    EvaluatingSafety --> HumanHandoff: Urgent Indicator / Emergency Pattern Matched
    EvaluatingSafety --> UnderstandingIntent: Non-Urgent Operational Intent

    state UnderstandingIntent {
        [*] --> ClassifyCategory
        ClassifyCategory --> InformationalQuery: Policy / Hours / FAQ Intent
        ClassifyCategory --> ActionIntent: Booking / Cancel / Doctor Search
        ClassifyCategory --> OutOfScope: Unsupported Request
    }

    OutOfScope --> FormulatingResponse: Explain Scope Boundary Politely

    InformationalQuery --> RetrievingKnowledge: Invoke RAG Service
    RetrievingKnowledge --> FormulatingResponse: Context Chunks Injected

    ActionIntent --> CheckingSlots: Inspect Extracted Parameters
    
    state CheckingSlots <<choice>>
    CheckingSlots --> RequestingClarification: Missing Mandatory Slots (Date/Doctor/Specialty)
    CheckingSlots --> ConfirmationCheck: All Slots Present

    RequestingClarification --> FormulatingResponse: Ask User Specific Clarification

    state ConfirmationCheck <<choice>>
    ConfirmationCheck --> AwaitingConfirmation: State-Altering Action (Book/Cancel/Reschedule)
    ConfirmationCheck --> ExecutingTool: Read-Only Tool (find_doctors/get_availability)

    AwaitingConfirmation --> ReceivingInput: User Responds
    AwaitingConfirmation --> ExecutingTool: User Confirmed ("نعم / تمام")
    AwaitingConfirmation --> CancellingAction: User Declined ("لا / إلغاء")

    CancellingAction --> FormulatingResponse: Confirm Action Aborted

    state ExecutingTool {
        [*] --> DispatchREST: Send HTTP to Clinic Backend
        DispatchREST --> HandleBackendResponse
    }

    HandleBackendResponse --> InterpretingResult: HTTP 200/201 (Success)
    HandleBackendResponse --> ToolFailureHandling: HTTP 409 / 422 / 500 (Conflict/Error)

    ToolFailureHandling --> FormulatingResponse: Format Empathetic Recovery (e.g. Slot Taken)
    InterpretingResult --> FormulatingResponse: Synthesize Natural Confirmation

    FormulatingResponse --> RespondingToUser: Stream Audio / Send Text
    
    RespondingToUser --> Idle: Await Next Turn
    RespondingToUser --> EndSession: User Explicitly Concludes ("شكراً مع السلامة")

    HumanHandoff --> EmittingHandoffEvent: Notify Staff Queue & Play Advisory
    EmittingHandoffEvent --> EndSession: Session Transferred to Human Staff

    EndSession --> [*]
```

- **Source File:** [`ai-agent-workflow.mmd`](ai-agent-workflow.mmd)
- **Purpose:** Models the complete internal control graph of the conversational orchestrator, showing slot checks, clarification loops, confirmation prompts, error recovery, and safety escalation.

---

## 3. Conceptual Voice Flow & Barge-in Diagram

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#ffffff', 'primaryTextColor': '#000000', 'primaryBorderColor': '#000000', 'lineColor': '#000000', 'secondaryColor': '#ffffff', 'tertiaryColor': '#ffffff', 'edgeLabelBackground':'#ffffff' }}}%%
flowchart TB
    subgraph ClientBoundary [" Client Audio Ingress "]
        Caller["Caller / Browser Microphone & Speaker"]
    end

    subgraph VoiceGatewayLayer [" Voice Gateway (services/voice) "]
        WS_Handler["WebSocket Duplex Audio Stream Handler"]
        BargeInDetector["Barge-in / Interruption Detector (VAD)"]
        PlaybackBuffer["Outbound Audio Playback Buffer"]
    end

    subgraph ProviderAbstraction [" «interface» VoiceProvider Adapter "]
        Router{"Voice Strategy Router\n(Benchmarking Option)"}
        
        subgraph OptionA [" Implementation Candidate A: Realtime Voice Engine "]
            RealtimeEngine["Managed Realtime Voice Gateway\n(e.g., OpenAI Realtime / Gemini Live)\n- Native Token-Audio Stream\n- Integrated Turn Detection"]
        end

        subgraph OptionB [" Implementation Candidate B: Cascaded Pipeline (Baseline) "]
            STT["Speech-to-Text (STT)\n(Whisper Arabic / Groq)\nChunked Audio ➔ Text"]
            TTS["Text-to-Speech (TTS)\n(ElevenLabs / Azure Neural)\nText ➔ Synthesized Chunks"]
        end
    end

    subgraph OrchestrationLayer [" AI Agent Core (services/ai-agent) "]
        AgentCore["Agent Dialogue & Tool Engine\n- Intent Processing\n- Controlled Tool Invocation\n- Backend Mutation"]
    end

    Caller -->|"1. Audio Stream (PCM Chunks)"| WS_Handler
    WS_Handler --> BargeInDetector
    BargeInDetector --> Router

    Router -->|"Option A Stream"| RealtimeEngine
    Router -->|"Option B Audio"| STT

    STT -->|"2. Arabic / English Transcript"| AgentCore
    AgentCore -->|"3. Synthesized Text Response"| TTS
    TTS -->|"4. Audio Chunks"| PlaybackBuffer

    RealtimeEngine <-->|"Direct Bidirectional Events"| AgentCore
    RealtimeEngine -->|"Synthesized Chunks"| PlaybackBuffer

    PlaybackBuffer -->|"5. Outbound Audio Stream"| WS_Handler
    WS_Handler -->|"6. Audio Playback"| Caller

    Caller -.->|"Interruption: Caller speaks while assistant plays"| BargeInDetector
    BargeInDetector ==x|"IMMEDIATE FLUSH & TRUNCATE (< 50ms)"| PlaybackBuffer
```

- **Source File:** [`voice-flow-conceptual.mmd`](voice-flow-conceptual.mmd)
- **Purpose:** Details audio packet ingress, strategy routing between Candidate A (Realtime) and Candidate B (Cascaded), and immediate audio buffer truncation upon user barge-in.
- **Related Documentation:**
  - [Voice Architecture Contract](../../architecture/voice-architecture.md)
  - [Feasibility Audit (Section 2: Voice)](../../architecture/feasibility-audit.md)
