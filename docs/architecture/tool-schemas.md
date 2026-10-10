# AI Agent Tool Schemas & Contracts

> **PROJECT:** Agentic Clinic
> **DOCUMENT:** Controlled AI Agent Tool Schemas
> **STATUS:** Phase 1 Contract (implements [ADR-003](../decisions/ADR-003-patient-identity-booking-rules-and-channel.md); backend calls in [api-contracts.md](api-contracts.md))
> **PURPOSE:** The contract between the LLM and the tool layer in `services/ai-agent`.

---

## 1. Architectural Role of Tools

```
┌──────────┐  tool call   ┌──────────────────────────┐  HTTP + credentials  ┌────────────────┐
│   LLM    │ ───────────► │ Tool layer (deterministic │ ───────────────────► │ Clinic backend │
│ (untrusted) ◄────────── │ Python in services/ai-agent) ◄────────────────── │   / RAG        │
└──────────┘  tool result └──────────────────────────┘                      └────────────────┘
```

- The **LLM is untrusted**. It can only propose tool calls with arguments that match the schemas below.
- The **tool layer** is ordinary deterministic code. It validates arguments, attaches credentials, enforces the confirmation rule (§3), calls the backend, and returns a compact result.
- The **backend** enforces identity, ownership and every business rule. A tool never relies on the LLM for any of them.

### 1.1. What the LLM never sees or supplies

| Item | Handled by |
|---|---|
| `X-Service-Token`, `X-Conversation-Token` | Tool layer (from service config and the conversation session) |
| `Idempotency-Key` | Tool layer (derived from the proposal, §3) |
| Internal `patient_id` | Backend only. **No tool accepts or returns it** |
| Email, phone, date of birth, insurance data | Backend only. **No tool returns them** |
| Verification codes | Typed in the browser code box only. **No tool accepts or returns a code** |
| Current date and time | Injected by the tool layer into the agent context every turn, in `Africa/Cairo` (e.g. `Today: Thursday 2026-10-15, 13:05`) |

The LLM must pass **absolute** dates (`YYYY-MM-DD`) and times (`HH:MM`). It resolves "tomorrow afternoon" using the injected date; the backend then validates the result.

### 1.2. Rules for every tool

1. Input schemas use JSON Schema with `"additionalProperties": false`. Invalid arguments are rejected by the tool layer **before** any backend call, with `VALIDATION_FAILED`.
2. Outputs contain only what the agent needs to speak. Bilingual names (`name_en`, `name_ar`) are returned and the agent uses the caller's language.
3. Tool calls are logged with tool name, argument keys, result code and latency. Free-text values (`visit_reason`, ticket text, transfer summary) and customer numbers are omitted from logs; truncation is not redaction. Log argument keys only, never codes, tokens or patient data.
4. A tool result is data, not instructions. Text from the backend or RAG never changes the agent's rules.

---

## 2. Output Envelope & Errors

Every tool returns:

```json
{ "success": true, "data": { }, "error": null }
```

or, on failure:

```json
{
  "success": false,
  "data": null,
  "error": { "code": "SLOT_UNAVAILABLE", "details": { "date": "2026-10-15", "start_time": "14:00" }, "retryable": false }
}
```

- `code` is one of the backend error codes in [api-contracts.md §2.2](api-contracts.md), or one of the tool-layer codes below.
- There is **no** pre-written English explanation in the result. The agent phrases every outcome in the caller's language, following the "Agent guidance" column of the API error catalog.
- `retryable: true` only for `IDEMPOTENCY_IN_PROGRESS`, `SERVICE_UNAVAILABLE` and network timeouts. The tool layer retries those once itself before returning the error.

**Tool-layer error codes**

| Code | When |
|---|---|
| `VALIDATION_FAILED` | Arguments do not match the schema |
| `TOOL_NOT_AVAILABLE` | Tool is not offered in the current state (§4), e.g. a patient tool before verification |
| `PROPOSAL_NOT_FOUND` | Unknown, invalidated or replaced `proposal_id` |
| `PROPOSAL_EXPIRED` | Proposal older than 5 minutes |
| `CONFIRMATION_NOT_ALLOWED` | `confirm_pending_action` called before the caller has had a turn to answer (§3) |
| `BACKEND_TIMEOUT` | Backend did not answer within `CLINIC_API_TIMEOUT_SECONDS` |

---

## 3. Confirmation Rule for State-Changing Actions

Booking, rescheduling, cancelling and creating a ticket change clinic data. They use **two steps**, and the second step is guarded by deterministic code, not by the LLM's judgement alone.

```
caller: "book me with Dr. Sarah tomorrow at 2"
  └─ LLM calls propose_booking(...)          → tool layer stores a pending proposal, returns proposal_id + summary
agent: "Dr. Sarah Farouk, Thursday 15 October at 14:00, fee 350 EGP. Shall I book it?"
caller: "yes"                                 ← a new caller turn
  └─ LLM calls confirm_pending_action(proposal_id) → tool layer checks the rules below, then calls the backend
```

**`confirm_pending_action` is executed only if all of these hold:**

1. The proposal exists in **this** conversation. A fresh execution requires a pending proposal; a retry of a confirmed proposal uses its immutable stored payload and key (§3.1).
2. It is **less than 5 minutes** old.
3. The proposal summary has been delivered to the caller and at least **one new caller turn** has arrived after delivery. The gateway records delivery and caller-turn ids outside the LLM context. A proposal and its confirmation can never happen in the same model turn; an interrupted or undelivered summary must be delivered again before confirmation.
4. The patient session that created the proposal is still valid and is the same session.
5. Only **one** proposal is pending at a time. A new `propose_*` call replaces the previous one.

**Idempotency.** The tool layer derives the backend `Idempotency-Key` from the `proposal_id`. Confirming the same proposal twice (e.g. after a network error) returns the original result and never books twice.

**What the LLM still decides:** whether the caller's answer means "yes". The delivery and turn checks guarantee a chance to answer, but do **not** prove affirmative consent; the LLM still interprets the answer. Negative or ambiguous replies must not execute an action and are required adversarial evaluation cases; the summary the agent reads out comes from the tool result, not from the LLM's memory. A visible on-screen confirmation button is a possible later improvement, not MVP.

---

### 3.1. Proposal execution lifecycle

The deterministic tool layer serializes confirmation per conversation and stores `pending` → `executing` → `succeeded` or `failed`, the original patient-session binding, immutable action payload, delivery/turn ids, idempotency key and terminal result. These values are service state, not model-controlled arguments.

- The five-minute expiry applies to the **first** execution. Once executing, a timeout is an **unknown outcome**, not proof of failure. Keep the original payload/key and reconcile by retrying the backend; never create a replacement booking automatically.
- A duplicate confirmation returns the cached terminal result or reconciles an executing action with the same backend key. It never performs a fresh mutation. Make `confirm_pending_action` available for reconciliation while that action is executing or has a retained result.
- Retain completed/uncertain action records for the live conversation (at most 60 minutes); the backend retains idempotency responses for 24 hours. End of call, logout, account switch or invalid session invalidates proposals and prevents replay to another account. Re-verification requires a fresh proposal unless reconciliation is performed internally without exposing another session's data.
- A new proposal replaces only a pending proposal. Do not replace an executing action before its outcome is resolved. Definite failure requires a new proposal and a new caller confirmation.

## 4. Tool Availability by Conversation State

The orchestrator only offers the LLM the tools that make sense in the current state. Fewer tools means fewer wrong tool choices.

| State | Tools offered |
|---|---|
| **Unverified** (start of call) | Public tools (§5.2), `request_verification_code`, `start_registration`, `search_clinic_knowledge`, `transfer_to_human` |
| **Verification pending** | Same as unverified. The agent waits for the `verified` event from the tool layer |
| **Verified** | Everything above **plus** patient tools (§5.3, §5.4) and `log_out` |
| **Proposal pending** | Same as verified, plus `confirm_pending_action` (also retained for execution reconciliation, §3.1) |

Calling a tool outside its state returns `TOOL_NOT_AVAILABLE` (defence in depth; the backend would also reject it).

---

## 5. Tool Specifications

### 5.1. Identity tools

#### 5.1.1. `request_verification_code`
- **Purpose:** Start login verification. The backend emails a code; the call page shows the code box.
- **Backend:** `POST /verification/challenges`
- **Input:**
  ```json
  {
    "type": "object",
    "properties": {
      "customer_number": { "type": "string", "pattern": "^[0-9]{6}$", "description": "6-digit customer number spoken by the caller, digits only." }
    },
    "required": ["customer_number"],
    "additionalProperties": false
  }
  ```
- **Output `data`:** `{ "state": "pending", "delivery": "email_on_file", "expires_in_seconds": 300 }` — identical for known and unknown numbers.
- **Agent says:** "If this number is registered, we've sent a code to the email on file. Please type it in the box on your screen." Never asks the caller to read the code aloud.
- **Side effect:** the tool layer tells the call page to show the code box. When the code is accepted, the tool layer gives the agent a `verified` event and switches the state (§4).
- **Errors:** `INVALID_CUSTOMER_NUMBER` (ask to repeat), `RATE_LIMITED`.

#### 5.1.2. `start_registration`
- **Purpose:** Open the registration form on the call page for a first-time caller.
- **Backend:** none directly; the page submits `POST /registrations` itself.
- **Input:** `{ "type": "object", "properties": {}, "additionalProperties": false }`
- **Output `data`:** `{ "form_shown": true }`
- **Agent says:** "Please fill in the short form on your screen; we'll email you a code to confirm it." The agent **never** collects name, phone, date of birth or email by voice.
- **Errors:** `CONVERSATION_INVALID`.

#### 5.1.3. `log_out`
- **Purpose:** End the patient session (caller asks to log out or switch account).
- **Backend:** `POST /patients/me/logout`
- **Input:** `{ "type": "object", "properties": {}, "additionalProperties": false }`
- **Output `data`:** `{ "logged_out": true }`

---

### 5.2. Public tools (no verification needed)

#### 5.2.1. `find_doctors`
- **Purpose:** Find doctors by specialty or name, in Arabic or English.
- **Backend:** `GET /doctors`
- **Input:**
  ```json
  {
    "type": "object",
    "properties": {
      "query": { "type": "string", "maxLength": 100, "description": "What the caller said, e.g. 'قلب', 'عيون', 'cardiology', 'Dr. Sarah'. Matched against names and specialty synonyms." },
      "specialty_id": { "type": "integer", "minimum": 1 },
      "limit": { "type": "integer", "minimum": 1, "maximum": 10, "default": 5 }
    },
    "additionalProperties": false
  }
  ```
- **Output `data`:**
  ```json
  {
    "count": 1,
    "doctors": [
      {
        "doctor_id": 12,
        "name_en": "Dr. Sarah Farouk", "name_ar": "د. سارة فاروق",
        "title_en": "Consultant Cardiologist", "title_ar": "استشاري أمراض القلب",
        "specialty_en": "Cardiology", "specialty_ar": "أمراض القلب",
        "consultation_fee_egp": 350.00
      }
    ]
  }
  ```
  An empty list is a success with `count: 0`; the agent offers to search differently.

#### 5.2.2. `get_doctor_information`
- **Purpose:** Full profile of one doctor, including working days and hours.
- **Backend:** `GET /doctors/{doctor_id}`
- **Input:** `{"type":"object","properties":{"doctor_id":{"type":"integer","minimum":1}},"required":["doctor_id"],"additionalProperties":false}`
- **Output `data`:** `doctor_id`, names, titles, specialty names, `bio_en`, `bio_ar`, `languages`, `consultation_fee_egp`, `working_days` (e.g. `["saturday","sunday"]`), `working_hours` (`{ "start": "10:00", "end": "14:00" }`).
- **Errors:** `DOCTOR_NOT_FOUND`.

#### 5.2.3. `get_doctor_availability`
- **Purpose:** Free slots for one doctor over up to 7 inclusive dates.
- **Backend:** `GET /doctors/{doctor_id}/availability`
- **Input:**
  ```json
  {
    "type": "object",
    "properties": {
      "doctor_id": { "type": "integer", "minimum": 1 },
      "from_date": { "type": "string", "format": "date" },
      "to_date": { "type": "string", "format": "date", "description": "Optional, at most 6 days after from_date." }
    },
    "required": ["doctor_id", "from_date"],
    "additionalProperties": false
  }
  ```
- **Output `data`:** `{ "doctor_id": 12, "days": [ { "date": "2026-10-15", "slots": ["10:00","10:30"] }, { "date": "2026-10-16", "slots": [], "reason": "CLINIC_CLOSED" } ] }`
- **Note:** slots are a snapshot; booking can still return `SLOT_UNAVAILABLE`.
- **Errors:** `DOCTOR_NOT_FOUND`, `VALIDATION_FAILED`.

#### 5.2.4. `search_availability`
- **Purpose:** Earliest free slots across doctors, e.g. "first available dermatologist tomorrow after 4".
- **Backend:** `GET /availability/search`
- **Input:**
  ```json
  {
    "type": "object",
    "properties": {
      "specialty_id": { "type": "integer", "minimum": 1 },
      "doctor_id": { "type": "integer", "minimum": 1 },
      "from_date": { "type": "string", "format": "date" },
      "to_date": { "type": "string", "format": "date" },
      "earliest_time": { "type": "string", "pattern": "^([01][0-9]|2[0-3]):[0-5][0-9]$" },
      "latest_time": { "type": "string", "pattern": "^([01][0-9]|2[0-3]):[0-5][0-9]$" },
      "limit": { "type": "integer", "minimum": 1, "maximum": 10, "default": 3 }
    },
    "required": ["from_date"],
    "additionalProperties": false
  }
  ```
  Time-of-day words map to ranges in the agent prompt: morning `07:00–12:00`, afternoon `12:00–17:00`, evening `17:00–22:00`.
- **Output `data`:** `{ "results": [ { "doctor_id": 12, "name_en": "Dr. Sarah Farouk", "name_ar": "د. سارة فاروق", "date": "2026-10-15", "start_time": "14:00" } ] }`

#### 5.2.5. `list_services`
- **Purpose:** Clinic services with prices.
- **Backend:** `GET /services`
- **Input:** `{"type":"object","properties":{"category":{"type":"string","maxLength":64}},"additionalProperties":false}`
- **Output `data`:** `{ "services": [ { "service_id": 2, "name_en": "Echocardiogram (Echo)", "name_ar": "إيكو على القلب", "category": "diagnostic", "price_egp": 600.00, "duration_minutes": 45 } ] }`

#### 5.2.6. `get_service_information`
- **Purpose:** Description, price and preparation instructions for one service.
- **Backend:** `GET /services/{service_id}`
- **Input:** `{"type":"object","properties":{"service_id":{"type":"integer","minimum":1}},"required":["service_id"],"additionalProperties":false}`
- **Output `data`:** `service_id`, names, `description_en/_ar`, `price_egp`, `duration_minutes`, `preparation_instructions_en/_ar`.
- **Errors:** `SERVICE_NOT_FOUND`.
- **Rule:** prices are always taken from this tool or `list_services`, never from RAG passages.

#### 5.2.7. `search_clinic_knowledge`
- **Purpose:** Answer informational questions (hours, location, policies, insurance networks, FAQs) from clinic documents.
- **Backend:** `POST /api/v1/rag/retrieve` ([rag-contract.md](rag-contract.md)); `top_k` is fixed by the tool layer (3).
- **Input:**
  ```json
  {
    "type": "object",
    "properties": {
      "query": { "type": "string", "minLength": 2, "maxLength": 300 },
      "language": { "type": "string", "enum": ["ar", "en"] },
      "category": { "type": "string", "enum": ["hours", "location", "policies", "insurance", "preparation", "faq"] }
    },
    "required": ["query", "language"],
    "additionalProperties": false
  }
  ```
- **Output `data`:** `{ "passages": [ { "title": "General Appointment Cancellation Policy", "content": "…", "source_document": "clinic_policies_2026.pdf", "chunk_id": "doc_pol_012_chunk_03" } ], "no_answer": false }`
- **Rules:** the agent answers **only** from returned passages. `no_answer: true` (no passage above the confidence threshold, Phase 3) means the agent says it does not know and offers a human. RAG never books, cancels or authorizes anything.

---

### 5.3. Patient read tools (verified only)

#### 5.3.1. `get_my_profile`
- **Backend:** `GET /patients/me`
- **Input:** `{"type":"object","properties":{},"additionalProperties":false}`
- **Output `data`:** `{ "customer_number": "482133", "first_name": "Ahmed", "preferred_language": "ar" }`

#### 5.3.2. `get_my_appointments`
- **Backend:** `GET /patients/me/appointments`
- **Input:**
  ```json
  {
    "type": "object",
    "properties": {
      "status_filter": { "type": "string", "enum": ["scheduled", "completed", "cancelled", "no_show", "all"], "default": "scheduled" },
      "include_past": { "type": "boolean", "default": false }
    },
    "additionalProperties": false
  }
  ```
- **Output `data`:**
  ```json
  {
    "count": 1,
    "appointments": [
      {
        "appointment_id": 501,
        "doctor_name_en": "Dr. Sarah Farouk", "doctor_name_ar": "د. سارة فاروق",
        "specialty_en": "Cardiology", "specialty_ar": "أمراض القلب",
        "date": "2026-10-15", "start_time": "14:00",
        "status": "scheduled",
        "can_change": true
      }
    ]
  }
  ```
  `can_change: false` means the 4-hour window has closed; the agent offers reception instead of proposing a change.

#### 5.3.3. `get_my_tickets`
- **Backend:** `GET /patients/me/tickets` or `GET /patients/me/tickets/{ticket_id}`
- **Input:** `{"type":"object","properties":{"ticket_id":{"type":"integer","minimum":1},"status":{"type":"string","enum":["open","in_progress","resolved","closed"]}},"additionalProperties":false}`
- **Output `data`:** `{ "tickets": [ { "ticket_id": 801, "subject": "…", "status": "in_progress", "priority": "normal", "last_updated": "2026-10-11T09:00:00Z" } ] }`
- **Errors:** `TICKET_NOT_FOUND`.

---

### 5.4. Patient write tools (verified only, two-step)

All four `propose_*` tools have **no side effect on clinic data**. They validate the request, store one pending proposal in the conversation, and return a summary for the agent to read back.

**Common proposal output `data`:**
```json
{
  "proposal_id": "prop_7Hq2…",
  "action": "book_appointment",
  "summary": { },
  "expires_in_seconds": 300
}
```

#### 5.4.1. `propose_booking`
- **Input:**
  ```json
  {
    "type": "object",
    "properties": {
      "doctor_id": { "type": "integer", "minimum": 1 },
      "date": { "type": "string", "format": "date" },
      "start_time": { "type": "string", "pattern": "^([01][0-9]|2[0-3]):(00|30)$" },
      "visit_reason": { "type": "string", "maxLength": 300, "description": "Optional administrative reason, e.g. 'follow-up'. Do not ask for symptoms." }
    },
    "required": ["doctor_id", "date", "start_time"],
    "additionalProperties": false
  }
  ```
- **Pre-check:** the tool layer confirms the slot is currently listed by `GET /doctors/{id}/availability` and returns `SLOT_UNAVAILABLE` early if not. Final rule checks happen at confirmation.
- **`summary`:** `{ "doctor_name_en", "doctor_name_ar", "specialty_en", "specialty_ar", "date", "start_time", "consultation_fee_egp" }`
- **On confirm →** `POST /patients/me/appointments`. Result `data`: the appointment as in `get_my_appointments`.
- **Confirm errors:** every booking error in api-contracts §6.4.

#### 5.4.2. `propose_reschedule`
- **Input:**
  ```json
  {
    "type": "object",
    "properties": {
      "appointment_id": { "type": "integer", "minimum": 1 },
      "new_date": { "type": "string", "format": "date" },
      "new_start_time": { "type": "string", "pattern": "^([01][0-9]|2[0-3]):(00|30)$" }
    },
    "required": ["appointment_id", "new_date", "new_start_time"],
    "additionalProperties": false
  }
  ```
- **Pre-check:** the appointment belongs to the caller (`GET /patients/me/appointments/{id}`) and `can_change` is `true`; the new slot is listed as available for the same doctor.
- **`summary`:** `{ "doctor_name_en", "doctor_name_ar", "current": { "date", "start_time" }, "new": { "date", "start_time" } }`
- **On confirm →** `POST /patients/me/appointments/{id}/reschedule`. All-or-nothing: on any error the original appointment is unchanged, and the agent says so.
- **Confirm errors:** api-contracts §6.5.

#### 5.4.3. `propose_cancellation`
- **Input:**
  ```json
  {
    "type": "object",
    "properties": {
      "appointment_id": { "type": "integer", "minimum": 1 },
      "reason": { "type": "string", "maxLength": 300 }
    },
    "required": ["appointment_id"],
    "additionalProperties": false
  }
  ```
- **Pre-check:** ownership and `can_change`.
- **`summary`:** `{ "doctor_name_en", "doctor_name_ar", "date", "start_time" }`
- **On confirm →** `POST /patients/me/appointments/{id}/cancel`. Result `data`: `{ "appointment_id": 501, "status": "cancelled" }`
- **Confirm errors:** api-contracts §6.6.

#### 5.4.4. `propose_ticket`
- **Input:**
  ```json
  {
    "type": "object",
    "properties": {
      "subject": { "type": "string", "minLength": 3, "maxLength": 255 },
      "description": { "type": "string", "minLength": 10, "maxLength": 2000 },
      "priority": { "type": "string", "enum": ["low", "normal", "high"], "default": "normal" }
    },
    "required": ["subject", "description"],
    "additionalProperties": false
  }
  ```
- **`summary`:** `{ "subject", "priority" }`
- **On confirm →** `POST /patients/me/tickets`. Result `data`: `{ "ticket_id": 801, "status": "open" }`
- **Rule:** tickets are for non-clinical issues. Medical questions are never turned into tickets; the agent offers a human instead.

#### 5.4.5. `confirm_pending_action`
- **Purpose:** Execute the pending proposal after the caller agreed.
- **Input:**
  ```json
  {
    "type": "object",
    "properties": { "proposal_id": { "type": "string", "pattern": "^prop_[A-Za-z0-9_-]{8,64}$" } },
    "required": ["proposal_id"],
    "additionalProperties": false
  }
  ```
- **Behaviour:** applies the rules in §3, then calls the backend endpoint for the proposal's action with the derived `Idempotency-Key`.
- **Output `data`:** the result described under each `propose_*` tool, plus `"action"`.
- **Errors:** `PROPOSAL_NOT_FOUND`, `PROPOSAL_EXPIRED`, `CONFIRMATION_NOT_ALLOWED`, `SESSION_EXPIRED`, plus the backend errors of the action.

---

### 5.5. Escalation

#### 5.5.1. `transfer_to_human`
- **Purpose:** Hand the conversation to clinic staff.
- **Backend:** `POST /escalations` — **Phase 2**; endpoint and table are added in a later PR (api-contracts §8). Until then the tool layer records only reason category, urgency and an internal correlation id in the conversation log (no raw summary) and returns `transferred: false`.
- **When:** the caller asks for a person; repeated failures (3 in a row); `CHANGE_WINDOW_CLOSED` and the caller still needs a change; the caller cannot register; anything medical. Emergency keywords trigger it **deterministically before the LLM runs** (ADR-002 Decision 2.4); the agent may also call it.
- **Input:**
  ```json
  {
    "type": "object",
    "properties": {
      "reason_category": { "type": "string", "enum": ["caller_request", "emergency_indicator", "repeated_failure", "change_window_closed", "cannot_register", "medical_question", "other"] },
      "urgency": { "type": "string", "enum": ["routine", "urgent", "emergency"], "default": "routine" },
      "summary": { "type": "string", "maxLength": 500, "description": "1–2 sentences for staff. No codes, tokens or contact details." }
    },
    "required": ["reason_category", "summary"],
    "additionalProperties": false
  }
  ```
- **Output `data` (Phase 1):** `{ "transferred": false, "handoff_recorded": true, "reason": "NOT_IMPLEMENTED" }`. Say that live transfer is unavailable; do not claim a person is connected or invent a queue position. Phase 2 must separately distinguish queued, accepted and connected states; recording or queueing is never a completed transfer.
- **Emergency wording:** for `emergency`, the agent also says to call the ambulance number **123** immediately, and gives no medical advice.
- **Errors:** `TRANSFER_QUEUE_UNAVAILABLE`.

---

## 6. Tool Catalog Summary

| # | Tool | Group | Backend | Changes data |
|---|---|---|---|:-:|
| 1 | `request_verification_code` | Identity | `POST /verification/challenges` | — |
| 2 | `start_registration` | Identity | (page submits `POST /registrations`) | — |
| 3 | `log_out` | Identity | `POST /patients/me/logout` | — |
| 4 | `find_doctors` | Public | `GET /doctors` | — |
| 5 | `get_doctor_information` | Public | `GET /doctors/{id}` | — |
| 6 | `get_doctor_availability` | Public | `GET /doctors/{id}/availability` | — |
| 7 | `search_availability` | Public | `GET /availability/search` | — |
| 8 | `list_services` | Public | `GET /services` | — |
| 9 | `get_service_information` | Public | `GET /services/{id}` | — |
| 10 | `search_clinic_knowledge` | Public | `POST /api/v1/rag/retrieve` | — |
| 11 | `get_my_profile` | Patient read | `GET /patients/me` | — |
| 12 | `get_my_appointments` | Patient read | `GET /patients/me/appointments` | — |
| 13 | `get_my_tickets` | Patient read | `GET /patients/me/tickets[/{id}]` | — |
| 14 | `propose_booking` | Patient write | (none until confirmed) | — |
| 15 | `propose_reschedule` | Patient write | (none until confirmed) | — |
| 16 | `propose_cancellation` | Patient write | (none until confirmed) | — |
| 17 | `propose_ticket` | Patient write | (none until confirmed) | — |
| 18 | `confirm_pending_action` | Patient write | book / reschedule / cancel / ticket endpoint | ✓ |
| 19 | `transfer_to_human` | Escalation | `POST /escalations` (Phase 2) | ✓ |

---

## 7. Changes from the Phase 0 Tool Schemas

| Phase 0 | Now | Reason |
|---|---|---|
| `patient_id` input on `get_patient_information`, `get_patient_appointments`, `book_appointment`, `create_support_ticket` | Removed from every tool; the patient comes from the verified session | ADR-003 §3.1 |
| `get_patient_information` returned phone and insurance provider | `get_my_profile` returns customer number, first name, language | ADR-003 §3.9 |
| No verification tools | `request_verification_code`, `start_registration`, `log_out` | ADR-003 §3.2–§3.4 |
| `book_appointment`, `cancel_appointment`, `reschedule_appointment`, `create_support_ticket` executed directly, with a prompt-only "confirmation required" flag | `propose_*` + `confirm_pending_action`, with a deterministic turn check and proposal-based idempotency | Confirmation enforced by code, not only by the prompt |
| `reschedule_appointment` output status `rescheduled` | Status stays `scheduled` | ADR-003 §3.6 |
| `book_appointment` output `confirmation_code` | Removed; the appointment id is the reference | Not in the API contract |
| `user_facing_explanation` (English) in errors | Removed; the agent phrases errors in the caller's language from the code | Arabic/English support |
| Availability for one date only | `get_doctor_availability` (≤ 7 days) and new `search_availability` | Fewer calls for "first available" |
| `get_ticket_status` | `get_my_tickets` (single ticket or list, own tickets only) | Ownership enforcement |
| No RAG tool in the list | `search_clinic_knowledge` | RAG access is explicit and logged like other tools |
| `transfer_to_human` free-text reason | `reason_category` enum + summary; emergency keywords trigger it before the LLM | Measurable escalation accuracy (evaluation plan) |
| 13 tools, all always available | 19 tools, offered by conversation state | Fewer wrong tool choices |

**Consistency references:** `services/ai-agent/AGENTS.md` (§2.3 names `book_appointment`, `cancel_appointment`, `reschedule_appointment`; uses the propose/confirm rule) and `docs/product/requirements.md` REQ-AI-03 (19 state-filtered tools).


## 8. Deterministic API adapter mapping

All clinic paths above are relative to `/api/v1`. RAG uses its own service base URL. Tool outputs intentionally differ from API DTOs; never forward raw API responses to the LLM.

| Tool field/result | API field/result | Mapping |
|---|---|---|
| `find_doctors.query` | query parameter `q` | Rename; preserve Arabic text |
| `get_my_appointments.status_filter`, `include_past` | `status`, `upcoming_only` | Rename; `upcoming_only = not include_past` for every status |
| `propose_reschedule.new_date`, `new_start_time` | body `date`, `start_time` | Rename; appointment id goes in the path |
| `search_clinic_knowledge.category` | `filter_category` | Rename; tool layer sets `top_k=3` |
| API `id`, nested doctor/specialty names and money | tool `doctor_id` / `appointment_id` / `service_id` / `ticket_id`, flattened names, `*_egp` | Explicit allowlist; use `amount` only after validating `currency=EGP` |
| API `total` | tool `count` | `count` is the number of returned items, not the total across pages; patient tools exhaust pagination up to the configured safe bound and indicate truncation |
| API ticket object or list | tool `tickets` | Always wrap a single ticket in a list; `updated_at` maps to `last_updated` |
| API verification `expires_at` | tool `expires_in_seconds` | Remaining seconds from injected clock, clamped at zero |
| RAG `retrieved_chunks[].metadata.source_document` | `passages[].source_document` | Flatten the allowlisted metadata; apply configured relevance threshold; empty accepted passages means `no_answer=true` |

`get_my_tickets` rejects simultaneous `ticket_id` and `status` with `VALIDATION_FAILED`. Date/time formats and range order are validated by actual parsers, not regex or JSON Schema annotations alone. Both availability tools allow at most seven **inclusive** clinic dates (`to_date - from_date ≤ 6 days`); default `to_date=from_date`. Time filters use `earliest_time ≤ slot_start < latest_time`, with `earliest_time < latest_time` when both supplied. Optional schema defaults are applied deterministically.

Strip profile/contact fields, `visit_reason`, cancellation reasons, resolution notes and raw request/error bodies unless explicitly allowlisted in the outputs above. `can_change` requires a scheduled future appointment **and** an open change window. Limit backend error `details` to the documented fields appropriate for that tool. Retry writes only with their original immutable idempotency key.
