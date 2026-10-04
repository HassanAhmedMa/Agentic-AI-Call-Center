# Requirements Traceability Matrix

> **PROJECT:** Agentic Clinic  
> **DOCUMENT:** Requirements ➔ Architecture ➔ Verification Traceability  
> **STATUS:** Phase 0 Baseline

---

## 1. Traceability Matrix

This matrix maps every functional requirement defined in [`docs/product/requirements.md`](../product/requirements.md) to its corresponding Use Case, REST API endpoint, AI Tool Schema, Database Entity, Sequence Workflow, and Verification Test Suite.

| Req ID | Requirement Description | Use Case | REST API Endpoint | AI Agent Tool Schema | DB Entity | Sequence / Workflow Diagram | Verification Test Suite |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-PAT-01** | Patient Lookup | View Patient Information | `GET /patients/{id}` | `get_patient_information` | `PATIENTS` | Subsystems / Use Case System | `tests/integration/test_patient_api.py` |
| **REQ-PAT-02** | Patient Profile Details | View Patient Information | `GET /patients/{id}` | `get_patient_information` | `PATIENTS` | Subsystems / Use Case System | `tests/integration/test_patient_api.py` |
| **REQ-PAT-03** | Patient Appointment History | View Patient Appointments | `GET /patients/{id}/appointments` | `get_patient_appointments` | `PATIENTS`, `APPOINTMENTS` | `seq-appointment-cancellation.mmd` | `tests/integration/test_patient_api.py` |
| **REQ-DOC-01** | List Doctors & Search | Find Doctor & Specialty | `GET /doctors` | `find_doctors` | `DOCTORS` | `seq-appointment-booking.mmd` | `tests/integration/test_doctor_api.py` |
| **REQ-DOC-02** | Doctor Profile Details | Find Doctor & Specialty | `GET /doctors/{id}` | `get_doctor_information` | `DOCTORS` | Subsystems / Use Case System | `tests/integration/test_doctor_api.py` |
| **REQ-DOC-03** | Specialty Filtering | Find Doctor & Specialty | `GET /doctors?specialty=...` | `find_doctors` | `DOCTORS` | `seq-appointment-booking.mmd` | `tests/integration/test_doctor_api.py` |
| **REQ-DOC-04** | Check Doctor Availability | Check Doctor Availability | `GET /doctors/{id}/availability` | `get_doctor_availability` | `DOCTORS`, `APPOINTMENTS` | `seq-appointment-booking.mmd` | `tests/integration/test_doctor_api.py` |
| **REQ-APP-01** | View Appointment Details | View Appointments | `GET /appointments/{id}` | `get_patient_appointments` | `APPOINTMENTS` | Subsystems / Use Case System | `tests/integration/test_appointment_api.py` |
| **REQ-APP-02** | Create / Book Appointment | Book Appointment | `POST /appointments` | `book_appointment` *(Confirm req.)* | `APPOINTMENTS` | `seq-appointment-booking.mmd` | `tests/e2e/test_booking_flow.py` |
| **REQ-APP-03** | Cancel Appointment | Cancel Appointment | `DELETE /appointments/{id}` | `cancel_appointment` *(Confirm req.)* | `APPOINTMENTS` | `seq-appointment-cancellation.mmd`| `tests/e2e/test_cancellation_flow.py` |
| **REQ-APP-04** | Reschedule Appointment | Reschedule Appointment | `PATCH /appointments/{id}` | `reschedule_appointment` *(Confirm)* | `APPOINTMENTS` | `state-appointment.mmd` | `tests/integration/test_appointment_api.py` |
| **REQ-APP-05** | Prevent Duplicate Bookings | Book Appointment | `POST /appointments` | `book_appointment` | `APPOINTMENTS` (`uq_doctor_slot_active`) | `seq-tool-call-failure.mmd` | `tests/integration/test_concurrency.py` |
| **REQ-APP-06** | Reject Past-Date Bookings | Book Appointment | `POST /appointments` | `book_appointment` | `APPOINTMENTS` (Constraint) | `ai-agent-workflow.mmd` | `tests/integration/test_appointment_api.py` |
| **REQ-SRV-01** | List Clinic Services | View Service Catalog | `GET /services` | `list_services` | `SERVICES` | Subsystems / Use Case System | `tests/integration/test_services_api.py` |
| **REQ-SRV-02** | Service Details & Prep Info | View Service Catalog | `GET /services/{id}` | `get_service_information` | `SERVICES` | `seq-rag-query.mmd` | `tests/integration/test_services_api.py` |
| **REQ-SUP-01** | Create Support Ticket | Create Support Ticket | `POST /tickets` | `create_support_ticket` *(Confirm)* | `SUPPORT_TICKETS` | `state-support-ticket.mmd` | `tests/integration/test_tickets_api.py` |
| **REQ-SUP-02** | Retrieve Support Ticket | Track Support Ticket | `GET /tickets/{id}` | `get_ticket_status` | `SUPPORT_TICKETS` | `state-support-ticket.mmd` | `tests/integration/test_tickets_api.py` |
| **REQ-SUP-03** | Track Ticket Status | Track Support Ticket | `GET /tickets/{id}` | `get_ticket_status` | `SUPPORT_TICKETS` | `state-support-ticket.mmd` | `tests/integration/test_tickets_api.py` |
| **REQ-SUP-04** | Update / Resolve Ticket | Update & Resolve Tickets | `PATCH /tickets/{id}` | _Staff UI Operation_ | `SUPPORT_TICKETS` | `state-support-ticket.mmd` | `tests/integration/test_tickets_api.py` |
| **REQ-ESC-01** | Human Assistance / Escalation| Request Human Assistance | _WebSocket Gateway Event_ | `transfer_to_human` | _Session State_ | `seq-human-handoff.mmd` | `tests/e2e/test_handoff_flow.py` |
| **REQ-AI-01**  | Multilingual & Dialect NLU | Engage in Voice Dialogue | Internal Orchestrator | `find_doctors`, `book_appointment` | _N/A_ | `seq-appointment-booking.mmd` | `tests/evaluation/test_dialects.py` |
| **REQ-AI-02**  | Slot Filling & Clarification | Clarify Missing Slots | Internal Orchestrator | Slot Extraction Logic | _Session Memory_ | `ai-agent-workflow.mmd` | `tests/evaluation/test_slot_filling.py` |
| **REQ-AI-03**  | Controlled Tool Selection | Invoke Controlled Tools | Internal Dispatcher | 13 Approved Tool Schemas | _N/A_ | `architecture-subsystems.mmd` | `tests/evaluation/test_tool_calling.py` |
| **REQ-AI-04**  | Natural Result Translation | Engage in Voice Dialogue | Internal Orchestrator | Error Envelope Mapper | _N/A_ | `seq-tool-call-failure.mmd` | `tests/evaluation/test_tone.py` |
| **REQ-AI-05**  | Multi-Turn Dialogue Memory | Engage in Voice Dialogue | Session Manager | Redis / In-Memory Session | `D2: Session Store` | `dfd-conversation-tools.mmd` | `tests/integration/test_session.py` |
| **REQ-AI-06**  | RAG Informational Grounding | Query Clinic Knowledge | `POST /rag/retrieve` | RAG Retriever Adapter | `Vector Knowledge Store` | `seq-rag-query.mmd` | `tests/evaluation/test_rag_fidelity.py` |
| **REQ-AI-07**  | Scope & Boundary Refusal | Engage in Voice Dialogue | Guardrails Filter | Refusal Handlers | _N/A_ | `ai-agent-workflow.mmd` | `tests/evaluation/test_adversarial.py` |
| **REQ-AI-08**  | Zero Hallucination Invariant | All Conversational Turns | Strict Tool Dispatcher | Backend REST Verification | `APPOINTMENTS` | `architecture-subsystems.mmd` | `tests/evaluation/test_hallucination.py`|
| **REQ-AI-09**  | Predefined Safety Escalation| Safety Trigger / Escalation| Internal Safety Rules | `transfer_to_human` (emergency) | _N/A_ | `seq-human-handoff.mmd` | `tests/evaluation/test_safety_rules.py` |
