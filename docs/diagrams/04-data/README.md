# 04 - Data Models, States & Data Flows

This directory contains the structural data models, entity relationships, entity state machines, and data flow diagrams.

---

## 1. Entity-Relationship Diagram (ERD)

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#ffffff', 'primaryTextColor': '#000000', 'primaryBorderColor': '#000000', 'lineColor': '#000000', 'secondaryColor': '#ffffff', 'tertiaryColor': '#ffffff', 'edgeLabelBackground':'#ffffff' }}}%%
erDiagram
    PATIENTS {
        bigint id PK
        varchar name
        varchar phone UK
        varchar email UK
        date date_of_birth
        varchar gender
        varchar insurance_provider
        varchar insurance_policy_number
        timestamp created_at
        timestamp updated_at
    }

    DOCTORS {
        bigint id PK
        varchar name
        varchar specialty
        varchar title
        text description
        text_array languages
        numeric consultation_fee
        varchar_array working_days
        time shift_start
        time shift_end
        integer slot_duration_minutes
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    APPOINTMENTS {
        bigint id PK
        bigint patient_id FK
        bigint doctor_id FK
        date appointment_date
        time start_time
        time end_time
        appointment_status status
        text notes
        text cancellation_reason
        timestamp created_at
        timestamp updated_at
    }

    SERVICES {
        bigint id PK
        varchar name UK
        varchar category
        text description
        numeric price
        integer duration_minutes
        text preparation_instructions
        boolean is_available
        timestamp created_at
    }

    SUPPORT_TICKETS {
        bigint id PK
        bigint patient_id FK
        varchar subject
        text description
        ticket_status status
        ticket_priority priority
        text resolution_notes
        timestamp created_at
        timestamp updated_at
    }

    PATIENTS ||--o{ APPOINTMENTS : "places (1:N)"
    DOCTORS ||--o{ APPOINTMENTS : "conducts (1:N)"
    PATIENTS ||--o{ SUPPORT_TICKETS : "files (1:N)"
```

- **Source File:** [`entity-relationship-diagram.mmd`](entity-relationship-diagram.mmd)
- **Purpose:** Full database entity structure, primary/foreign keys, and exact table attributes.

---

## 2. Conceptual Domain Class Diagram

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#ffffff', 'primaryTextColor': '#000000', 'primaryBorderColor': '#000000', 'lineColor': '#000000', 'secondaryColor': '#ffffff', 'tertiaryColor': '#ffffff', 'edgeLabelBackground':'#ffffff' }}}%%
classDiagram
    class Patient {
        +int id
        +string name
        +string phone
        +string email
        +Date dateOfBirth
        +string insuranceProvider
        +getAppointmentHistory() List~Appointment~
        +getActiveTickets() List~SupportTicket~
    }

    class Doctor {
        +int id
        +string name
        +string specialty
        +string title
        +List~string~ languages
        +float consultationFee
        +List~string~ workingDays
        +getAvailableSlots(Date date) List~TimeSlot~
    }

    class Appointment {
        +int id
        +int patientId
        +int doctorId
        +Date date
        +Time startTime
        +Time endTime
        +AppointmentStatus status
        +string notes
        +cancel(string reason) void
        +reschedule(Date newDate, Time newTime) void
    }

    class Service {
        +int id
        +string name
        +string category
        +float price
        +int durationMinutes
        +string prepInstructions
    }

    class SupportTicket {
        +int id
        +int patientId
        +string subject
        +string description
        +TicketStatus status
        +TicketPriority priority
        +resolve(string notes) void
    }

    class AgentSession {
        +string sessionId
        +int patientId
        +string language
        +List~Turn~ turnHistory
        +Intent currentIntent
        +appendTurn(string role, string content) void
    }

    class ToolCall {
        +string toolName
        +Map parameters
        +boolean confirmationRequired
        +boolean userConfirmed
        +execute() ToolResult
    }

    Patient "1" --> "*" Appointment : books
    Doctor "1" --> "*" Appointment : attends
    Patient "1" --> "*" SupportTicket : opens
    AgentSession "1" --> "*" ToolCall : proposes
    ToolCall ..> Appointment : mutates
    ToolCall ..> SupportTicket : creates
```

- **Source File:** [`domain-class-diagram.mmd`](domain-class-diagram.mmd)
- **Purpose:** Object-oriented conceptual model linking clinical domain entities with conversational session state and tool executions.

---

## 3. Lifecycle State Diagrams

### Appointment State Diagram
```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#ffffff', 'primaryTextColor': '#000000', 'primaryBorderColor': '#000000', 'lineColor': '#000000', 'secondaryColor': '#ffffff', 'tertiaryColor': '#ffffff', 'edgeLabelBackground':'#ffffff' }}}%%
stateDiagram-v2
    [*] --> Scheduled: POST /appointments (Slot Confirmed)
    Scheduled --> Completed: Clinic Visit Attended & Concluded
    Scheduled --> Cancelled: DELETE /appointments/{id} (Patient / Clinic Cancelled)
    Scheduled --> NoShow: Patient Missed Appointment Window
    Scheduled --> Rescheduled: PATCH /appointments/{id} (New Slot Requested)
    Rescheduled --> Scheduled: New Slot Validated & Reserved
    Completed --> [*]: Final State
    Cancelled --> [*]: Final State (Slot Freed)
    NoShow --> [*]: Final State
```
- **Source File:** [`state-appointment.mmd`](state-appointment.mmd)

### Support Ticket State Diagram
```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#ffffff', 'primaryTextColor': '#000000', 'primaryBorderColor': '#000000', 'lineColor': '#000000', 'secondaryColor': '#ffffff', 'tertiaryColor': '#ffffff', 'edgeLabelBackground':'#ffffff' }}}%%
stateDiagram-v2
    [*] --> Open: POST /tickets (Ticket Created by Agent / Patient)
    Open --> InProgress: Staff Begins Review & Investigation
    Open --> Resolved: Direct Quick Resolution
    InProgress --> Resolved: Solution / Information Provided to Patient
    Resolved --> Closed: Patient / Staff Confirms Resolution (Archive)
    Resolved --> InProgress: Patient Reports Issue Remains Unresolved
    Closed --> [*]: Archived Ticket
```
- **Source File:** [`state-support-ticket.mmd`](state-support-ticket.mmd)

---

## 4. Data Flow Diagrams (DFDs)

### Level 1 DFD: Conversational Booking & Operations
- **Source File:** [`dfd-conversation-tools.mmd`](dfd-conversation-tools.mmd)
- Demonstrates audio stream processing, intent extraction, dialogue session caching, deterministic backend validation, and relational database writes.

### RAG Knowledge Ingestion & Retrieval DFD
- **Source File:** [`dfd-rag-ingestion.mmd`](dfd-rag-ingestion.mmd)
- Details the dual pipeline: offline document parsing/chunking/embedding into the vector store, and online query embedding/top-k retrieval with source citations.
