# 02 - Use Case Diagrams

This folder contains the complete UML Use Case documentation for **Agentic Clinic**, structured into a high-level system operations diagram and an AI agent interaction diagram.

---

## 1. High-Level System Use Case Diagram

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#ffffff', 'primaryTextColor': '#000000', 'primaryBorderColor': '#000000', 'lineColor': '#000000', 'secondaryColor': '#ffffff', 'tertiaryColor': '#ffffff', 'edgeLabelBackground':'#ffffff' }}}%%
flowchart LR
    subgraph Actors [" Primary Actors "]
        Patient(("Patient / Caller"))
        Staff(("Clinic Staff"))
        Admin(("Administrator"))
    end

    subgraph ClinicBoundary [" Agentic Clinic Operations Boundary "]
        UC_FindDoc(["Find Doctor & Specialty"])
        UC_CheckAvail(["Check Doctor Availability"])
        UC_BookAppt(["Book Appointment"])
        UC_CancelAppt(["Cancel Appointment"])
        UC_RescheduleAppt(["Reschedule Appointment"])
        UC_ViewHistory(["View Patient Appointments"])
        UC_ViewServices(["View Service Catalog & Pricing"])
        UC_CreateTicket(["Create Support Ticket"])
        UC_TrackTicket(["Track Support Ticket Status"])
        UC_RequestHandoff(["Request Human Assistance"])
        
        UC_ManageRoster(["Manage Doctor Rosters & Shifts"])
        UC_ManageCatalog(["Manage Clinic Services & Pricing"])
        UC_HandleHandoff(["Answer Escalated Calls / Cases"])
        UC_ResolveTicket(["Update & Resolve Support Tickets"])
    end

    Patient --> UC_FindDoc
    Patient --> UC_CheckAvail
    Patient --> UC_BookAppt
    Patient --> UC_CancelAppt
    Patient --> UC_RescheduleAppt
    Patient --> UC_ViewHistory
    Patient --> UC_ViewServices
    Patient --> UC_CreateTicket
    Patient --> UC_TrackTicket
    Patient --> UC_RequestHandoff

    Staff --> UC_HandleHandoff
    Staff --> UC_ResolveTicket
    Staff --> UC_ViewHistory
    Staff --> UC_CheckAvail

    Admin --> UC_ManageRoster
    Admin --> UC_ManageCatalog
```

- **Source File:** [`use-case-system.mmd`](use-case-system.mmd)
- **Purpose:** Maps functional capabilities across the three principal human actors.
- **What it Shows:**
  - Patient operations (finding doctors, availability, booking, rescheduling, cancellation, service checks, support ticketing).
  - Staff operations (handling human handoffs, resolving tickets, viewing patient appointments).
  - Admin operations (maintaining rosters, shifts, and medical catalogs).
- **What it Intentionally Does Not Show:** Internal software layers or database schemas.

---

## 2. AI Agent Interaction Use Case Diagram

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#ffffff', 'primaryTextColor': '#000000', 'primaryBorderColor': '#000000', 'lineColor': '#000000', 'secondaryColor': '#ffffff', 'tertiaryColor': '#ffffff', 'edgeLabelBackground':'#ffffff' }}}%%
flowchart LR
    Caller(("Patient / Caller\n(Voice / Chat)"))
    Staff(("Clinic Human Staff\n(Escalation Queue)"))
    
    subgraph AgentBoundary [" AI Agent Conversational Boundary "]
        UC_VoiceChat(["Engage in Voice / Text Dialogue\n(Arabic / Egyptian / English)"])
        UC_Clarify(["Clarify Intent & Missing Slots\n(Specialty, Date, Time)"])
        UC_QueryRAG(["Query Clinic Knowledge (RAG)\n(Hours, Policies, Prep Rules)"])
        UC_ExecTools(["Invoke Controlled Operation Tools"])
        UC_ConfirmAction(["Solicit Confirmation for State Changes\n(Booking, Cancellation, Rescheduling)"])
        UC_SafetyEscalate(["Escalate via Predefined Safety Rules\n(Urgent Indicators / Frustration)"])
    end

    subgraph BackendBoundary [" Clinic Backend API Enforcement "]
        API_ValidateSlot(["Validate Slot & Prevent Overlap"])
        API_MutateDB(["Execute Atomic DB Booking / Update"])
    end

    Caller --> UC_VoiceChat
    UC_VoiceChat --> UC_Clarify
    UC_VoiceChat --> UC_QueryRAG
    UC_VoiceChat --> UC_ExecTools
    UC_VoiceChat --> UC_SafetyEscalate

    UC_ExecTools -.->|"«include»"| UC_ConfirmAction
    UC_ExecTools --> API_ValidateSlot
    API_ValidateSlot --> API_MutateDB

    UC_SafetyEscalate --> Staff
```

- **Source File:** [`use-case-ai-agent.mmd`](use-case-ai-agent.mmd)
- **Purpose:** Illustrates how the AI Agent orchestrator mediates conversational intent, guardrails, confirmation checks, and backend execution.
- **What it Shows:**
  - Conversational understanding in Arabic, Egyptian dialect, and English.
  - Mandatory confirmation solicitation (`«include»`) prior to state-altering tool execution.
  - Escalation to human staff based on predefined safety rules and patient request.
  - Backend validation boundary ensuring zero unvalidated database writes.
- **Related Documentation:**
  - [Product Requirements](../../product/requirements.md)
  - [Tool Schemas Contract](../../architecture/tool-schemas.md)
