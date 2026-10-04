# 02 - UML Use Case Diagrams

This directory contains the official UML Use Case models for **Agentic Clinic**, adhering strictly to the **standard UML Use Case notation**:
- **Actors:** Represented as standard UML stick figures.
- **Use Cases:** Represented as standard UML horizontal ovals / ellipses.
- **System Boundaries:** Represented as clean enclosing rectangles.
- **Visual Style:** Pure black-and-white monochrome (high-contrast, professional, suitable for university thesis, academic reports, and printed documentation).

---

## 1. High-Level System Operations Use Case Diagram

### Visual Render (Standard UML: Stickman & Ovals)
![System Use Case Diagram](use-case-system.svg)

### Source Specifications
- **Rendered SVG:** [`use-case-system.svg`](use-case-system.svg)
- **PlantUML Source:** [`use-case-system.puml`](use-case-system.puml)
- **Mermaid Source:** [`use-case-system.mmd`](use-case-system.mmd)

### Description & Boundaries:
- **Actors:**
  - `Patient / Caller`: Interacts via text chat and voice streams to discover doctors, inspect availability, manage appointments, query service fees, open support tickets, and request human assistance.
  - `Clinic Staff`: Receptionists and clinic coordinators who answer escalated calls, resolve customer tickets, view patient histories, and verify doctor schedules.
  - `Administrator`: Maintains doctor rosters, shifts, and the clinic service/pricing catalog.
- **Boundary:** Encloses core clinic functional operations within the `Agentic Clinic Operations Boundary`.

---

## 2. AI Agent Conversational Interaction Use Case Diagram

### Visual Render (Standard UML: Stickman & Ovals)
![AI Agent Use Case Diagram](use-case-ai-agent.svg)

### Source Specifications
- **Rendered SVG:** [`use-case-ai-agent.svg`](use-case-ai-agent.svg)
- **PlantUML Source:** [`use-case-ai-agent.puml`](use-case-ai-agent.puml)
- **Mermaid Source:** [`use-case-ai-agent.mmd`](use-case-ai-agent.mmd)

### Description & Relationships:
- **Primary Actor:** `Patient / Caller` interacts with the primary use case `Engage in Voice / Text Dialogue`.
- **Secondary Actor:** `Clinic Human Staff` receives escalated sessions via the `Escalate via Predefined Safety Rules` use case.
- **UML Stereotypes:**
  - `«extend»`: Clarification of missing slots, RAG informational querying, and predefined safety escalation conditionally extend the dialogue.
  - `«include»`: Invoking controlled tools always includes mandatory user confirmation before executing state-altering actions (`book_appointment`, `cancel_appointment`, `reschedule_appointment`).
- **Backend Boundary:** Controlled tools invoke `Validate Slot & Rules` on the Clinic Backend REST API, which deterministically enforces constraints before `Execute Atomic Mutation` in PostgreSQL.

---

## 3. PlantUML Source Code

<details>
<summary>Click to view System Use Case PlantUML Source (use-case-system.puml)</summary>

```plantuml
@startuml
skinparam monochrome true
skinparam shadowing false
skinparam defaultFontName Arial
skinparam packageStyle rectangle

left to right direction

actor "Patient / Caller" as Patient
actor "Clinic Staff" as Staff
actor "Administrator" as Admin

rectangle "Agentic Clinic Operations Boundary" {
  usecase "Find Doctor & Specialty" as UC_FindDoc
  usecase "Check Doctor Availability" as UC_CheckAvail
  usecase "Book Appointment" as UC_BookAppt
  usecase "Cancel Appointment" as UC_CancelAppt
  usecase "Reschedule Appointment" as UC_ReschedAppt
  usecase "View Patient Appointments" as UC_ViewAppts
  usecase "View Service Catalog & Pricing" as UC_ViewServices
  usecase "Create Support Ticket" as UC_CreateTicket
  usecase "Track Support Ticket Status" as UC_TrackTicket
  usecase "Request Human Assistance" as UC_RequestHandoff
  
  usecase "Manage Doctor Rosters & Shifts" as UC_ManageRoster
  usecase "Manage Services Catalog & Pricing" as UC_ManageCatalog
  usecase "Answer Escalated Calls / Cases" as UC_HandleHandoff
  usecase "Update & Resolve Support Tickets" as UC_ResolveTicket
}

Patient -- UC_FindDoc
Patient -- UC_CheckAvail
Patient -- UC_BookAppt
Patient -- UC_CancelAppt
Patient -- UC_ReschedAppt
Patient -- UC_ViewAppts
Patient -- UC_ViewServices
Patient -- UC_CreateTicket
Patient -- UC_TrackTicket
Patient -- UC_RequestHandoff

Staff -- UC_HandleHandoff
Staff -- UC_ResolveTicket
Staff -- UC_ViewAppts
Staff -- UC_CheckAvail

Admin -- UC_ManageRoster
Admin -- UC_ManageCatalog
@enduml
```

</details>

<details>
<summary>Click to view AI Agent Interaction PlantUML Source (use-case-ai-agent.puml)</summary>

```plantuml
@startuml
skinparam monochrome true
skinparam shadowing false
skinparam defaultFontName Arial
skinparam packageStyle rectangle

left to right direction

actor "Patient / Caller" as Patient
actor "Clinic Human Staff" as Staff

rectangle "AI Agent Conversational Boundary" {
  usecase "Engage in Voice / Text Dialogue\n(Arabic / Egyptian / English)" as UC_Dialogue
  usecase "Clarify Intent & Missing Slots\n(Specialty, Date, Time)" as UC_Clarify
  usecase "Query Clinic Knowledge (RAG)\n(Hours, Policies, Prep Rules)" as UC_RAG
  usecase "Invoke Controlled Operation Tools" as UC_Tools
  usecase "Solicit Confirmation for State Changes\n(Booking, Cancellation, Rescheduling)" as UC_Confirm
  usecase "Escalate via Predefined Safety Rules\n(Urgent Indicators / Frustration)" as UC_Escalate
}

rectangle "Clinic Backend API Enforcement" {
  usecase "Validate Slot & Prevent Overlap" as UC_Validate
  usecase "Execute Atomic DB Booking / Update" as UC_Mutate
}

Patient -- UC_Dialogue
UC_Dialogue ..> UC_Clarify : <<extend>>
UC_Dialogue ..> UC_RAG : <<extend>>
UC_Dialogue ..> UC_Tools : <<include>>
UC_Dialogue ..> UC_Escalate : <<extend>>

UC_Tools ..> UC_Confirm : <<include>>
UC_Tools --> UC_Validate
UC_Validate --> UC_Mutate

UC_Escalate -- Staff
@enduml
```

</details>
