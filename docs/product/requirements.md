# Product & Functional Requirements

> **PROJECT:** Agentic Clinic  
> **DOCUMENT:** Functional Requirements Specification  
> **PHASE:** Phase 0 Architecture Contract

---

## 1. Domain Feature Requirements

### 1.1. Patient Features
- **REQ-PAT-01 (Patient Lookup):** Patient data is selected only by the backend session bound to the current conversation; customer number starts email verification and phone is never authentication.
- **REQ-PAT-02 (Patient Profile):** The agent receives only customer number, first name and preferred language; contact, DOB and insurance fields are never tool outputs.
- **REQ-PAT-03 (Appointment History):** The system must allow retrieving upcoming, past, and cancelled visits for a patient.

### 1.2. Doctor Features
- **REQ-DOC-01 (List Doctors):** The system must support browsing doctors, with optional filtering by specialty and search keywords.
- **REQ-DOC-02 (Doctor Profile):** The system must return detailed physician credentials, consultation fees, and languages spoken.
- **REQ-DOC-03 (Doctor Specialty Index):** The system must support clinical specialties (Cardiology, Dermatology, Pediatrics, Orthopedics, Internal Medicine).
- **REQ-DOC-04 (Doctor Availability):** The system must compute and return unoccupied 30-minute booking slots for a requested future date.

### 1.3. Appointment Features
- **REQ-APP-01 (View Appointment):** Retrieve only an appointment owned by the verified account; unknown and foreign ids both return 404.
- **REQ-APP-02 (Create Appointment):** Atomically book an available slot between a patient and a doctor.
- **REQ-APP-03 (Cancel Appointment):** Safely cancel a scheduled appointment with an optional cancellation reason.
- **REQ-APP-04 (Reschedule Appointment):** Atomically move an owned scheduled visit to another slot with the same doctor; status remains scheduled and history records the change. Failure preserves the original.
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
- **REQ-ESC-01 (Transfer to Human):** The system requests human assistance on caller demand, repeated failures or predefined safety indicators. Phase 1 records a request and truthfully reports live transfer unavailable; Phase 2 adds an authenticated queue and distinguishes queued, accepted and connected states.

---

## 2. AI Conversational & Orchestration Requirements

- **REQ-AI-01 (Intent Recognition):** Understand user intents across English, Modern Standard Arabic (MSA), and Egyptian Arabic dialect (العامية المصرية).
- **REQ-AI-02 (Slot Filling & Clarification):** Interactively prompt the user for missing parameters (e.g. asking for preferred time of day if only date is specified).
- **REQ-AI-03 (Tool Selection):** Accurately map user requests to the 19 state-filtered tools defined in `docs/architecture/tool-schemas.md`.
- **REQ-AI-04 (Result Interpretation):** Convert backend structured JSON responses into concise, empathetic conversational replies.
- **REQ-AI-05 (Multi-Turn Context):** Maintain session context across turns (retaining selected doctor, date, or appointment context).
- **REQ-AI-06 (RAG for Information):** Automatically route informational queries (hours, policies, directions) to the RAG knowledge retriever.
- **REQ-AI-07 (Boundary Refusal):** Politely and firmly refuse unauthorized requests, medical diagnosis demands, or attempts to execute arbitrary commands.
- **REQ-AI-08 (Zero Hallucination Constraint):** Prohibit inventing doctor availability or confirming bookings without actual backend API verification.
- **REQ-AI-09 (Predefined Safety Escalation):** Potentially urgent situations trigger immediate escalation to human personnel according to predefined safety rules and pattern matchers, without attempting clinical diagnosis or symptom triage.


## 3. Identity, booking and browser acceptance requirements (ADR-003, Proposed)

- **REQ-ID-01:** Login uses a valid six-digit Luhn customer number and single-use six-digit email code; browser code entry alone completes verification. Mailpit is the development sender; mock codes work only for seeded test accounts in development/test, with a startup guard.
- **REQ-ID-02:** Register using a browser form with name, contact phone, DOB, email, language and consent. Email is normalized, unique and verified; shared phones are allowed; records are never linked automatically.
- **REQ-ID-03:** Known/unknown login numbers and new/existing emails have indistinguishable pending responses, attempts and rate limits. Service credentials alone grant no patient access.
- **REQ-ID-04:** Sessions enforce 15-minute idle and 60-minute absolute expiry, immediate logout/end revocation and a five-minute disconnect resume window. Concurrent account switching invalidates proposals and challenges safely.
- **REQ-APP-07:** Enforce aligned 30-minute shifts within 07:00–22:00 Cairo time, Friday/closure/time-off exclusions, ≥1-hour lead time, ≤30-day horizon and ≥4-hour change notice.
- **REQ-APP-08:** Enforce at most two future scheduled visits per clinic date, different doctors, and five total per account under concurrent transactions. Rescheduling excludes the moved visit from both counts.
- **REQ-APP-09:** Four write operations require account/operation-scoped idempotency, target-inclusive fingerprints and atomic response/mutation persistence for 24-hour replay.
- **REQ-AI-10:** Use stored proposals with delivered summaries, a subsequent affirmative caller turn, session checks and safe retry reconciliation. Never treat a timeout as a definite failed write.
- **REQ-UI-01:** The mobile browser supports Call, transcript, direct code entry, registration and resume. HTTPS and Android/iPhone Wi-Fi/4G tests precede the mobile milestone. Public information needs no verification.
- **REQ-DOC-05:** Catalog names/specialties are stored in Arabic and English; normalized Arabic synonyms support discovery. Prices and availability come from APIs.

Staff mutations and staff authentication require their own approved contracts; planned test paths in traceability are deliverables, not implemented tests.
