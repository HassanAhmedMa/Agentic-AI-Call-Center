# 04 - Data Models, States & Data Flows

This directory contains the structural data models, entity relationships, entity state machines, and data flow diagrams.

All diagrams are rendered with an **opaque solid white canvas** for high-contrast viewing on both dark and light modes.

---

## 1. Entity-Relationship Diagram (ERD)

![Entity Relationship Diagram](entity-relationship-diagram.svg)

- **Vector Image:** [`entity-relationship-diagram.svg`](entity-relationship-diagram.svg)
- **High-Res PNG:** [`entity-relationship-diagram.png`](entity-relationship-diagram.png)
- **Source File:** [`entity-relationship-diagram.mmd`](entity-relationship-diagram.mmd)
- **Purpose:** Full database entity structure, primary/foreign keys, and exact table attributes.

---

## 2. Conceptual Domain Class Diagram

![Domain Class Diagram](domain-class-diagram.svg)

- **Vector Image:** [`domain-class-diagram.svg`](domain-class-diagram.svg)
- **High-Res PNG:** [`domain-class-diagram.png`](domain-class-diagram.png)
- **Source File:** [`domain-class-diagram.mmd`](domain-class-diagram.mmd)
- **Purpose:** Object-oriented conceptual model linking clinical domain entities with conversational session state and tool executions.

---

## 3. Lifecycle State Diagrams

### Appointment State Diagram
![Appointment State Diagram](state-appointment.svg)
- **Vector Image:** [`state-appointment.svg`](state-appointment.svg)
- **Source File:** [`state-appointment.mmd`](state-appointment.mmd)

### Support Ticket State Diagram
![Support Ticket State Diagram](state-support-ticket.svg)
- **Vector Image:** [`state-support-ticket.svg`](state-support-ticket.svg)
- **Source File:** [`state-support-ticket.mmd`](state-support-ticket.mmd)

---

## 4. Data Flow Diagrams (DFDs)

### Level 1 DFD: Conversational Booking & Operations
![DFD Level 1](dfd-conversation-tools.svg)
- **Vector Image:** [`dfd-conversation-tools.svg`](dfd-conversation-tools.svg)
- **Source File:** [`dfd-conversation-tools.mmd`](dfd-conversation-tools.mmd)
- Demonstrates audio stream processing, intent extraction, dialogue session caching, deterministic backend validation, and relational database writes.

### RAG Knowledge Ingestion & Retrieval DFD
![RAG Ingestion DFD](dfd-rag-ingestion.svg)
- **Vector Image:** [`dfd-rag-ingestion.svg`](dfd-rag-ingestion.svg)
- **Source File:** [`dfd-rag-ingestion.mmd`](dfd-rag-ingestion.mmd)
- Details the dual pipeline: offline document parsing/chunking/embedding into the vector store, and online query embedding/top-k retrieval with source citations.
