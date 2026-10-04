# 05 - Sequence Diagrams

This directory contains UML Sequence Diagrams detailing the exact temporal message flows, boundaries, and error recovery paths across the system.

---

## 1. Appointment Booking Sequence
- **Source File:** [`seq-appointment-booking.mmd`](seq-appointment-booking.mmd)
- **Key Flow:** Dialectal Arabic voice input ➔ Intent extraction ➔ `find_doctors` ➔ `get_doctor_availability` ➔ Conversational option summary ➔ Patient selection ➔ Mandatory confirmation ➔ Atomic database transaction via `POST /appointments`.

---

## 2. Appointment Cancellation Sequence
- **Source File:** [`seq-appointment-cancellation.mmd`](seq-appointment-cancellation.mmd)
- **Key Flow:** Cancellation request ➔ Appointment retrieval ➔ **Mandatory confirmation guardrail** ("Are you sure you want to cancel?") ➔ Explicit user confirmation ➔ Soft delete via `DELETE /appointments/{id}` ➔ Slot freed in database.

---

## 3. RAG Knowledge Question Sequence
- **Source File:** [`seq-rag-query.mmd`](seq-rag-query.mmd)
- **Key Flow:** User policy inquiry ➔ Routing to `services/rag` ➔ Vector search in knowledge store ➔ Top-k chunk return with citations ➔ Grounded prompt injection ➔ Factual non-hallucinated reply.

---

## 4. Predefined Safety Escalation & Human Handoff
- **Source File:** [`seq-human-handoff.mmd`](seq-human-handoff.mmd)
- **Key Flow:** User reports acute symptoms / requests human ➔ Predefined safety rule trigger (non-diagnostic) ➔ `transfer_to_human` tool invocation ➔ WebSocket alert on clinic staff dashboard ➔ Non-clinical safety advisory to caller ➔ Receptionist accepts and bridges call.

---

## 5. Failed Tool Call & Conflict Recovery
- **Source File:** [`seq-tool-call-failure.mmd`](seq-tool-call-failure.mmd)
- **Key Flow:** Race-condition booking collision ➔ Unique partial index violation in PostgreSQL ➔ Backend rolls back transaction and emits `HTTP 409 Conflict` ➔ Agent catches conflict, queries remaining open slots, and gracefully offers alternatives to the caller.

---

## 6. Conceptual Voice Interaction & Barge-in Cutoff
- **Source File:** [`seq-voice-interaction.mmd`](seq-voice-interaction.mmd)
- **Key Flow:** Duplex audio chunk streaming ➔ VAD speech detection ➔ Text synthesis ➔ Mid-speech user interruption (barge-in) ➔ Sub-50ms queue flush and stream cancellation ➔ Immediate listening to new turn.
