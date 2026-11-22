# Requirements Traceability Matrix

> **PROJECT:** Agentic Clinic  
> **DOCUMENT:** Requirements ➔ Architecture ➔ Verification Traceability  
> **STATUS:** Phase 0 Baseline

---

## 1. Traceability Matrix

This matrix maps every functional requirement defined in [`docs/product/requirements.md`](../product/requirements.md) to its corresponding Use Case, REST API endpoint, AI Tool Schema, Database Entity, Sequence Workflow, and Verification Test Suite.

| Req ID | Requirement Description | Use Case | REST API Endpoint | AI Agent Tool Schema | DB Entity | Sequence / Workflow Diagram | Verification Test Suite |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-PAT-01** | Verified Current Patient | View Patient Information | `GET /patients/me` | `get_my_profile` | `PATIENTS` | Subsystems / Use Case System | `tests/integration/test_patient_api.py` |
| **REQ-PAT-02** | Minimal Agent Profile | View Patient Information | `GET /patients/me` | `get_my_profile` | `PATIENTS` | Subsystems / Use Case System | `tests/integration/test_patient_api.py` |
| **REQ-PAT-03** | Patient Appointment History | View Patient Appointments | `GET /patients/me/appointments` | `get_my_appointments` | `PATIENTS`, `APPOINTMENTS` | `seq-appointment-cancellation.mmd` | `tests/integration/test_patient_api.py` |
| **REQ-DOC-01** | List Doctors & Search | Find Doctor & Specialty | `GET /doctors` | `find_doctors` | `DOCTORS` | `seq-appointment-booking.mmd` | `tests/integration/test_doctor_api.py` |
| **REQ-DOC-02** | Doctor Profile Details | Find Doctor & Specialty | `GET /doctors/{id}` | `get_doctor_information` | `DOCTORS` | Subsystems / Use Case System | `tests/integration/test_doctor_api.py` |
| **REQ-DOC-03** | Specialty Filtering | Find Doctor & Specialty | `GET /doctors?specialty_id=...` | `find_doctors` | `DOCTORS` | `seq-appointment-booking.mmd` | `tests/integration/test_doctor_api.py` |
| **REQ-DOC-04** | Check Doctor Availability | Check Doctor Availability | `GET /doctors/{id}/availability` | `get_doctor_availability` | `DOCTORS`, `APPOINTMENTS` | `seq-appointment-booking.mmd` | `tests/integration/test_doctor_api.py` |
| **REQ-APP-01** | View Appointment Details | View Appointments | `GET /patients/me/appointments/{id}` | `get_my_appointments` | `APPOINTMENTS` | Subsystems / Use Case System | `tests/integration/test_appointment_api.py` |
| **REQ-APP-02** | Create / Book Appointment | Book Appointment | `POST /patients/me/appointments` | `propose_booking + confirm_pending_action` *(Confirm req.)* | `APPOINTMENTS` | `seq-appointment-booking.mmd` | `tests/e2e/test_booking_flow.py` |
| **REQ-APP-03** | Cancel Appointment | Cancel Appointment | `POST /patients/me/appointments/{id}/cancel` | `propose_cancellation + confirm_pending_action` *(Confirm req.)* | `APPOINTMENTS` | `seq-appointment-cancellation.mmd`| `tests/e2e/test_cancellation_flow.py` |
| **REQ-APP-04** | Reschedule Appointment | Reschedule Appointment | `POST /patients/me/appointments/{id}/reschedule` | `propose_reschedule + confirm_pending_action` *(Confirm)* | `APPOINTMENTS` | `state-appointment.mmd` | `tests/integration/test_appointment_api.py` |
| **REQ-APP-05** | Prevent Duplicate Bookings | Book Appointment | `POST /patients/me/appointments` | `propose_booking + confirm_pending_action` | `APPOINTMENTS` (`uq_doctor_slot_active`) | `seq-tool-call-failure.mmd` | `tests/integration/test_concurrency.py` |
| **REQ-APP-06** | Reject Past-Date Bookings | Book Appointment | `POST /patients/me/appointments` | `propose_booking + confirm_pending_action` | `APPOINTMENTS` (Constraint) | `ai-agent-workflow.mmd` | `tests/integration/test_appointment_api.py` |
| **REQ-SRV-01** | List Clinic Services | View Service Catalog | `GET /services` | `list_services` | `SERVICES` | Subsystems / Use Case System | `tests/integration/test_services_api.py` |
| **REQ-SRV-02** | Service Details & Prep Info | View Service Catalog | `GET /services/{id}` | `get_service_information` | `SERVICES` | `seq-rag-query.mmd` | `tests/integration/test_services_api.py` |
| **REQ-SUP-01** | Create Support Ticket | Create Support Ticket | `POST /patients/me/tickets` | `propose_ticket + confirm_pending_action` *(Confirm)* | `SUPPORT_TICKETS` | `state-support-ticket.mmd` | `tests/integration/test_tickets_api.py` |
| **REQ-SUP-02** | Retrieve Support Ticket | Track Support Ticket | `GET /patients/me/tickets/{id}` | `get_my_tickets` | `SUPPORT_TICKETS` | `state-support-ticket.mmd` | `tests/integration/test_tickets_api.py` |
| **REQ-SUP-03** | Track Ticket Status | Track Support Ticket | `GET /patients/me/tickets/{id}` | `get_my_tickets` | `SUPPORT_TICKETS` | `state-support-ticket.mmd` | `tests/integration/test_tickets_api.py` |
| **REQ-SUP-04** | Update / Resolve Ticket | Update & Resolve Tickets | `Deferred staff contract` | _Staff UI Operation_ | `SUPPORT_TICKETS` | `state-support-ticket.mmd` | `tests/integration/test_tickets_api.py` |
| **REQ-ESC-01** | Human Assistance / Escalation| Request Human Assistance | _WebSocket Gateway Event_ | `transfer_to_human` | _Session State_ | `seq-human-handoff.mmd` | `tests/e2e/test_handoff_flow.py` |
| **REQ-AI-01**  | Multilingual & Dialect NLU | Engage in Voice Dialogue | Internal Orchestrator | `find_doctors`, `propose_booking + confirm_pending_action` | _N/A_ | `seq-appointment-booking.mmd` | `tests/evaluation/test_dialects.py` |
| **REQ-AI-02**  | Slot Filling & Clarification | Clarify Missing Slots | Internal Orchestrator | Slot Extraction Logic | _Session Memory_ | `ai-agent-workflow.mmd` | `tests/evaluation/test_slot_filling.py` |
| **REQ-AI-03**  | Controlled Tool Selection | Invoke Controlled Tools | Internal Dispatcher | 19 State-filtered Tool Schemas | _N/A_ | `architecture-subsystems.mmd` | `tests/evaluation/test_tool_calling.py` |
| **REQ-AI-04**  | Natural Result Translation | Engage in Voice Dialogue | Internal Orchestrator | Error Envelope Mapper | _N/A_ | `seq-tool-call-failure.mmd` | `tests/evaluation/test_tone.py` |
| **REQ-AI-05**  | Multi-Turn Dialogue Memory | Engage in Voice Dialogue | Session Manager | Dialogue state; backend authoritative identity | `D2: Session Store` | `dfd-conversation-tools.mmd` | `tests/integration/test_session.py` |
| **REQ-AI-06**  | RAG Informational Grounding | Query Clinic Knowledge | `POST /rag/retrieve` | RAG Retriever Adapter | `Vector Knowledge Store` | `seq-rag-query.mmd` | `tests/evaluation/test_rag_fidelity.py` |
| **REQ-AI-07**  | Scope & Boundary Refusal | Engage in Voice Dialogue | Guardrails Filter | Refusal Handlers | _N/A_ | `ai-agent-workflow.mmd` | `tests/evaluation/test_adversarial.py` |
| **REQ-AI-08**  | Zero Hallucination Invariant | All Conversational Turns | Strict Tool Dispatcher | Backend REST Verification | `APPOINTMENTS` | `architecture-subsystems.mmd` | `tests/evaluation/test_hallucination.py`|
| **REQ-AI-09**  | Predefined Safety Escalation| Safety Trigger / Escalation| Internal Safety Rules | `transfer_to_human` (emergency) | _N/A_ | `seq-human-handoff.mmd` | `tests/evaluation/test_safety_rules.py` |


## ADR-003 requirements (planned verification; files do not yet exist)

| Requirements | Contract / implementation boundary | Required verification |
|---|---|---|
| REQ-ID-01, REQ-ID-02 | API §4; direct browser forms; challenges | Email OTP, single use, registration race, duplicate response, mock guard |
| REQ-ID-03 | API §1 and §10; identity/session middleware | Enumeration, service-only denial, ownership and multi-worker rate buckets |
| REQ-ID-04 | Session lifecycle; voice §5 | Expiry, resume, logout/account-switch and mutation races |
| REQ-APP-07, REQ-APP-08 | Backend domain rules; schema constraints | Exact boundaries, closures, patient limits, reschedule at five active visits, concurrent conflicts |
| REQ-APP-09 | API idempotency fingerprint and atomic transaction | Same/different body/route targets; crash/timeout/replay |
| REQ-AI-10 | Tool proposal lifecycle | Undelivered/interrupted summary, negative/ambiguous answer, expired proposal, repeated confirmation |
| REQ-UI-01 | Voice §5 and mobile forms | Actual Android/iPhone Wi-Fi/4G resume/code entry |
| REQ-DOC-05 | Bilingual catalog and normalized search | Arabic variants/synonyms, stored names, API-only prices |

All test paths in the original matrix are planned deliverables. Staff and escalation operations require approved Phase 2/deferred contracts; this matrix does not define undocumented endpoints.
