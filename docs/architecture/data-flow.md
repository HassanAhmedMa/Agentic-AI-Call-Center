# Data Flow Specifications

> **PROJECT:** Agentic Clinic  
> **DOCUMENT:** Conversational & Operational Data Flows  
> **PHASE:** Phase 0 Architecture Contract  
> **KEY PRINCIPLE:** Deterministic backend validation cannot be bypassed by LLM reasoning.

---

## Flow 1: Voice Appointment Booking (Egyptian Arabic)

### User Utterance:
> *"عايز أحجز مع دكتور قلب بكرة بعد الضهر"*  
> ("I want to book with a cardiologist tomorrow in the afternoon")

### Sequence Diagram:
```
Caller         Voice Layer         AI Agent            Tools          Backend API         Database
  │                 │                 │                  │                 │                 │
  ├─ Audio Stream ─►│                 │                  │                 │                 │
  │  (WebRTC/WS)    │                 │                  │                 │                 │
  │                 ├─ STT Event ────►│                  │                 │                 │
  │                 │  "عايز أحجز..."  │                  │                 │                 │
  │                 │                 ├─ Intent: BOOKING │                 │                 │
  │                 │                 │  Specialty: Cardio                 │                 │
  │                 │                 │  Target: Tomorrow│                 │                 │
  │                 │                 │  Period: Afternoon                 │                 │
  │                 │                 │                  │                 │                 │
  │                 │                 ├── find_doctors ─►│                 │                 │
  │                 │                 │   (Cardiology)   ├─ GET /doctors ─►│                 │
  │                 │                 │                  │  ?specialty=..  ├─ SELECT ───────►│
  │                 │                 │                  │                 │◄─ Doctor Rows ──┤
  │                 │                 │                  │◄─ Doctor List ──┤                 │
  │                 │                 │◄─ Returns Dr. 12 ┤                 │                 │
  │                 │                 │                  │                 │                 │
  │                 │                 ├── get_avail ────►│                 │                 │
  │                 │                 │   (Dr 12, date)  ├─ GET /avail ───►│                 │
  │                 │                 │                  │◄─ [14:00,15:00]─┤                 │
  │                 │                 │◄─ Slots Returned ┤                 │                 │
  │                 │                 │                  │                 │                 │
  │                 │◄─ Text Response ┤                  │                 │                 │
  │                 │  "عندنا دكتورة  │                  │                 │                 │
  │                 │   سارة فاروق..."│                  │                 │                 │
  │◄─ TTS Audio ────┤                 │                  │                 │                 │
  │  (Arabic Voice) │                 │                  │                 │                 │
  │                 │                 │                  │                 │                 │
  ├─ User Picks: ──►│                 │                  │                 │                 │
  │  "تمام الساعة 2"│─ STT Event ────►│                  │                 │                 │
  │                 │                 │                  │                 │                 │
  │                 │                 ├── Confirm Intent ┤                 │                 │
  │                 │                 ├── book_appoint ─►│                 │                 │
  │                 │                 │                  ├─ POST /appoint ─►│                 │
  │                 │                 │                  │  (Validate slot)├─ INSERT/LOCK ──►│
  │                 │                 │                  │                 │◄─ Confirmed ────┤
  │                 │                 │                  │◄─ 201 Created ──┤                 │
  │                 │                 │◄─ Booking Object ┤                 │                 │
  │                 │◄─ "حجز حضرتك تم │                  │                 │                 │
  │                 │   الساعة 2..."  │                  │                 │                 │
  │◄─ TTS Audio ────┤                 │                  │                 │                 │
```

### Detailed Execution Steps:
1. **Audio Ingestion:** Caller speaks into microphone; audio chunks stream to `services/voice`.
2. **Speech Recognition:** `VoiceProvider` STT transcribes dialectal audio to Arabic text.
3. **Intent Extraction:** `services/ai-agent` extracts:
   - Intent: `book_appointment`
   - Specialty: `Cardiology` (قلب)
   - Date: Computed relative date for "tomorrow" (`YYYY-MM-DD`)
   - Time Preference: Afternoon (بعد الضهر -> 12:00 to 17:00)
4. **Doctor Discovery:** Agent invokes tool `find_doctors(specialty="Cardiology")`.
5. **Backend Query:** Backend API executes `GET /api/v1/doctors?specialty=Cardiology`.
6. **Availability Verification:** Agent invokes `get_doctor_availability(doctor_id=12, date=...)`.
7. **Conversational Proposal:** Agent summarizes options naturally:
   *"عندنا دكتورة سارة فاروق استشاري القلب متاحة بكرة الساعة 2:00 والساعة 3:00 بعد الضهر. تحب أحجز لحضرتك الساعة 2؟"*
8. **User Confirmation:** Caller confirms: *"تمام الساعة 2"*.
9. **Controlled Mutation:** Agent invokes tool `book_appointment(...)`.
10. **Backend Business Validation:**
    - Checks doctor schedule constraints.
    - Prevents duplicate appointment collisions.
    - Executes atomic transaction in PostgreSQL.
11. **Confirmation Delivery:** Backend returns `201 Created` with booking reference; Agent confirms success over voice.

---

## Flow 2: Informational Policy Inquiry (RAG)

### User Utterance:
> *"What is your appointment cancellation policy, and can I get a refund?"*

### Execution Steps:
1. **User Input:** Utterance processed by voice or text interface.
2. **Intent Classification:** Classified as informational query (`CLINIC_POLICY_FAQ`).
3. **No Mutating Tool Called:** The agent recognizes that no database change is requested.
4. **RAG Retrieval:** AI Agent invokes `services/rag`:
   - Generates embedding for query.
   - Vector search locates top-k chunks from clinic policy documents.
5. **Contextual Generation:** Retrieved chunks (e.g., "Cancellations must be made at least 4 hours in advance for full refund") are injected into the LLM context.
6. **Synthesized Response:** Agent answers accurately with cited policy, without hallucinating exceptions.

---

## Flow 3: Appointment Cancellation with Safety Confirmation

### User Utterance:
> *"Cancel my appointment for tomorrow."*

### Execution Steps:
1. **Session Verification:** Agent checks active patient identifier.
2. **Appointment Lookup:** Agent calls `get_patient_appointments(patient_id=..., status="scheduled")`.
3. **Disambiguation / Confirmation Request:**
   - If one appointment exists: *"You have an appointment with Dr. Sarah Farouk tomorrow at 2:00 PM. Are you sure you want to cancel it?"*
   - Agent **pauses** and awaits explicit user confirmation (`Yes / Cancel it`).
4. **Action Execution:** Only upon receiving explicit confirmation does the agent call `cancel_appointment(appointment_id=501)`.
5. **Backend State Update:** Backend marks status `cancelled` and frees the slot.
6. **Confirmation Message:** Agent informs patient the slot is successfully cancelled.

---

## Flow 4: Escalation to Human Agent (Barge-in / Complex / Predefined Safety Trigger)

### Important Clarification:
> ⚠️ The AI Agent is **NOT** a medical diagnostic or clinical triage system.  
> Escalations are triggered by **predefined safety rules, pattern matchers, and explicit human requests**, ensuring the agent never attempts to assess symptoms or provide medical advice.

### User Utterance:
> *"I have severe chest pain and dizziness, I need to talk to someone right now!"*

### Execution Steps:
1. **Predefined Safety Rule Trigger:** The incoming utterance matches predefined critical keyword patterns ("severe chest pain", "emergency", "dizziness").
2. **Immediate Escalation:** The agent bypasses standard administrative and booking dialogue paths.
3. **Escalation Tool Invocation:** The agent invokes `transfer_to_human(urgency="emergency", reason="Reported critical keyword indicator: chest pain", conversation_summary="Caller stated chest pain and dizziness; requested immediate assistance.")`.
4. **Immediate Caller Safety Advisory:** The agent delivers a non-clinical safety disclaimer:
   *"I am escalating you to clinic human staff immediately. If you are experiencing an acute medical emergency, please call 123 (Emergency Ambulance Services) immediately."*
5. **Session Handoff Event:** The voice/session layer emits a handoff event, flagging the conversation in the clinic staff dashboard queue.

