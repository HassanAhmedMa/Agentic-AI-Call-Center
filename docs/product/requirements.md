# Product & Functional Requirements

> **PROJECT:** Agentic Clinic  
> **DOCUMENT:** Functional Requirements Specification  
> **PHASE:** Phase 0 Architecture Contract

---

## 1. Domain Feature Requirements

### 1.1. Patient Features
- **REQ-PAT-01 (Patient Lookup):** The system must allow lookup of patient records by unique `patient_id` or verified phone number.
- **REQ-PAT-02 (Patient Profile):** The system must expose demographic details, insurance provider, and contact info.
- **REQ-PAT-03 (Appointment History):** The system must allow retrieving upcoming, past, and cancelled visits for a patient.

### 1.2. Doctor Features
- **REQ-DOC-01 (List Doctors):** The system must support browsing doctors, with optional filtering by specialty and search keywords.
- **REQ-DOC-02 (Doctor Profile):** The system must return detailed physician credentials, consultation fees, and languages spoken.
- **REQ-DOC-03 (Doctor Specialty Index):** The system must support clinical specialties (Cardiology, Dermatology, Pediatrics, Orthopedics, Internal Medicine).
- **REQ-DOC-04 (Doctor Availability):** The system must compute and return unoccupied 30-minute booking slots for a requested future date.

### 1.3. Appointment Features
- **REQ-APP-01 (View Appointment):** Retrieve full details of any individual appointment by ID.
- **REQ-APP-02 (Create Appointment):** Atomically book an available slot between a patient and a doctor.
- **REQ-APP-03 (Cancel Appointment):** Safely cancel a scheduled appointment with an optional cancellation reason.
- **REQ-APP-04 (Reschedule Appointment):** Move an existing scheduled visit to an alternate open date/time slot.
- **REQ-APP-05 (Prevent Duplicate Bookings):** The backend must strictly reject double-booking attempts for the same doctor or overlapping bookings for the same patient.
- **REQ-APP-06 (Past-Date Prevention):** The backend must reject booking attempts on past dates or times.

### 1.4. Service Catalog Features
- **REQ-SRV-01 (List Services):** The system must provide a categorized directory of clinical procedures, diagnostics, and lab tests.
- **REQ-SRV-02 (Service Details):** Return duration, pricing, and clinical preparation requirements (e.g. fasting).

### 1.5. Support Ticket Features
- **REQ-SUP-01 (Create Support Ticket):** Allow patients to log non-clinical complaints, billing inquiries, or feedback.
- **REQ-SUP-02 (Retrieve Ticket):** Retrieve ticket details, priority, and timeline.
- **REQ-SUP-03 (Check Ticket Status):** Track status changes (`open`, `in_progress`, `resolved`, `closed`).
- **REQ-SUP-04 (Update Ticket Status):** Allow support staff to append resolution notes and resolve tickets.

### 1.6. Human Escalation (Handoff)
- **REQ-ESC-01 (Transfer to Human):** The system must support immediate transfer of active conversations to human clinic staff upon user demand, repeated misunderstanding, or medical emergency indications.

---

## 2. AI Conversational & Orchestration Requirements

- **REQ-AI-01 (Intent Recognition):** Understand user intents across English, Modern Standard Arabic (MSA), and Egyptian Arabic dialect (العامية المصرية).
- **REQ-AI-02 (Slot Filling & Clarification):** Interactively prompt the user for missing parameters (e.g. asking for preferred time of day if only date is specified).
- **REQ-AI-03 (Tool Selection):** Accurately map user requests to the 13 approved tools defined in `docs/architecture/tool-schemas.md`.
- **REQ-AI-04 (Result Interpretation):** Convert backend structured JSON responses into concise, empathetic conversational replies.
- **REQ-AI-05 (Multi-Turn Context):** Maintain session context across turns (retaining selected doctor, date, or appointment context).
- **REQ-AI-06 (RAG for Information):** Automatically route informational queries (hours, policies, directions) to the RAG knowledge retriever.
- **REQ-AI-07 (Boundary Refusal):** Politely and firmly refuse unauthorized requests, medical diagnosis demands, or attempts to execute arbitrary commands.
- **REQ-AI-08 (Zero Hallucination Constraint):** Prohibit inventing doctor availability or confirming bookings without actual backend API verification.
