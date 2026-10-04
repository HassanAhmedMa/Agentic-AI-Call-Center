# AI Agent Tool Schemas & Contracts

> **PROJECT:** Agentic Clinic  
> **DOCUMENT:** Controlled AI Agent Tool Schemas  
> **PHASE:** Phase 0 Architecture Contract  
> **PURPOSE:** Establishes the contract between the AI Agent orchestrator and external tools.

---

## 1. Architectural Role of Tools

Tools serve as the **controlled execution barrier** between the Large Language Model (LLM) and external systems. 

```
┌──────────┐         ┌───────────┐         ┌────────────────────┐         ┌───────────┐
│ AI Agent │ ──────► │   Tool    │ ──────► │ Clinic Backend API │ ──────► │ Database  │
│  (LLM)   │ ◄────── │ Execution │ ◄────── │     (REST API)     │ ◄────── │(PostgreSQL│
└──────────┘         └───────────┘         └────────────────────┘         └───────────┘
```

### Key Distinctions Between Tools and Backend APIs:
- **Backend APIs** are resource-oriented, enforce raw database constraints, and deal with system-level IDs and auth tokens.
- **Tools** are agent-oriented abstractions. They provide conversational guardrails, format natural arguments, handle error translation into user-comprehensible feedback, and enforce conversational confirmation policies.

---

## 2. Global Tool Conventions

### 2.1. Standard Tool Output Envelope
Every tool returns a structured JSON payload:
```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```
Or upon failure:
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "SLOT_UNAVAILABLE",
    "message": "The requested time slot is no longer available.",
    "user_facing_explanation": "That slot is unfortunately already booked. Would you like to check Dr. Sarah's other available times on that day?"
  }
}
```

### 2.2. Confirmation Required Flag
Certain tools alter state (e.g. creating/cancelling appointments). The agent **must solicit explicit user confirmation** before invoking these tools.

---

## 3. Tool Specifications

---

### 3.1. `get_patient_information`
- **Purpose:** Look up a patient's profile to personalize greetings and verify identity.
- **Confirmation Required:** `false`
- **Authorization Requirements:** Verified caller phone number or active patient session.
- **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "patient_id": {
        "type": "integer",
        "description": "Unique identifier of the patient."
      }
    },
    "required": ["patient_id"]
  }
  ```
- **Output Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "id": { "type": "integer" },
      "name": { "type": "string" },
      "phone": { "type": "string" },
      "insurance_provider": { "type": "string" }
    }
  }
  ```
- **Possible Errors:** `PATIENT_NOT_FOUND`, `UNAUTHORIZED_ACCESS`.

---

### 3.2. `get_patient_appointments`
- **Purpose:** Retrieve existing appointments for a patient.
- **Confirmation Required:** `false`
- **Authorization Requirements:** Active patient session.
- **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "patient_id": {
        "type": "integer",
        "description": "Patient ID."
      },
      "status_filter": {
        "type": "string",
        "enum": ["all", "scheduled", "completed", "cancelled"],
        "default": "scheduled"
      }
    },
    "required": ["patient_id"]
  }
  ```
- **Output Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "total": { "type": "integer" },
      "appointments": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "appointment_id": { "type": "integer" },
            "doctor_name": { "type": "string" },
            "specialty": { "type": "string" },
            "date": { "type": "string" },
            "time": { "type": "string" },
            "status": { "type": "string" }
          }
        }
      }
    }
  }
  ```
- **Possible Errors:** `PATIENT_NOT_FOUND`.

---

### 3.3. `find_doctors`
- **Purpose:** Search for doctors by medical specialty or name.
- **Confirmation Required:** `false`
- **Authorization Requirements:** Public / None.
- **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "specialty": {
        "type": "string",
        "description": "Medical specialty (e.g. Cardiology, Dermatology, Pediatrics, Orthopedics)."
      },
      "doctor_name": {
        "type": "string",
        "description": "Optional name query (e.g. 'Sarah' or 'Hegazi')."
      }
    }
  }
  ```
- **Output Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "count": { "type": "integer" },
      "doctors": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": { "type": "integer" },
            "name": { "type": "string" },
            "specialty": { "type": "string" },
            "title": { "type": "string" },
            "languages": { "type": "array", "items": { "type": "string" } },
            "consultation_fee": { "type": "number" }
          }
        }
      }
    }
  }
  ```
- **Possible Errors:** `NO_DOCTORS_FOUND`.

---

### 3.4. `get_doctor_information`
- **Purpose:** Retrieve full profile and credentials for a specific doctor.
- **Confirmation Required:** `false`
- **Authorization Requirements:** Public / None.
- **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "doctor_id": { "type": "integer", "description": "Doctor's ID." }
    },
    "required": ["doctor_id"]
  }
  ```
- **Output Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "id": { "type": "integer" },
      "name": { "type": "string" },
      "specialty": { "type": "string" },
      "description": { "type": "string" },
      "working_days": { "type": "array", "items": { "type": "string" } },
      "consultation_fee": { "type": "number" }
    }
  }
  ```
- **Possible Errors:** `DOCTOR_NOT_FOUND`.

---

### 3.5. `get_doctor_availability`
- **Purpose:** Retrieve open booking slots for a doctor on a specific date.
- **Confirmation Required:** `false`
- **Authorization Requirements:** Public / None.
- **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "doctor_id": { "type": "integer", "description": "Doctor ID." },
      "date": { "type": "string", "description": "Date in YYYY-MM-DD format." }
    },
    "required": ["doctor_id", "date"]
  }
  ```
- **Output Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "doctor_id": { "type": "integer" },
      "doctor_name": { "type": "string" },
      "date": { "type": "string" },
      "available_slots": {
        "type": "array",
        "items": { "type": "string" }
      }
    }
  }
  ```
- **Possible Errors:** `DOCTOR_NOT_FOUND`, `INVALID_DATE`, `OFF_DUTY_DATE`.

---

### 3.6. `book_appointment`
- **Purpose:** Confirm and create an appointment for a patient.
- **Confirmation Required:** `true` (The agent must summarize date, time, doctor, and get explicit user consent before calling).
- **Authorization Requirements:** Authenticated patient session.
- **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "patient_id": { "type": "integer" },
      "doctor_id": { "type": "integer" },
      "date": { "type": "string", "description": "YYYY-MM-DD" },
      "time": { "type": "string", "description": "HH:MM (24-hour format)" },
      "notes": { "type": "string", "description": "Reason for visit or symptoms" }
    },
    "required": ["patient_id", "doctor_id", "date", "time"]
  }
  ```
- **Output Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "appointment_id": { "type": "integer" },
      "doctor_name": { "type": "string" },
      "specialty": { "type": "string" },
      "date": { "type": "string" },
      "time": { "type": "string" },
      "status": { "type": "string" },
      "confirmation_code": { "type": "string" }
    }
  }
  ```
- **Possible Errors:** `SLOT_UNAVAILABLE`, `DUPLICATE_BOOKING`, `INVALID_PATIENT`, `INVALID_DOCTOR`.

---

### 3.7. `cancel_appointment`
- **Purpose:** Cancel an existing appointment.
- **Confirmation Required:** `true` (Agent must confirm appointment details with user before executing).
- **Authorization Requirements:** Authenticated patient session matching the appointment owner.
- **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "appointment_id": { "type": "integer" },
      "reason": { "type": "string", "description": "Optional cancellation reason" }
    },
    "required": ["appointment_id"]
  }
  ```
- **Output Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "appointment_id": { "type": "integer" },
      "status": { "type": "string", "example": "cancelled" },
      "message": { "type": "string" }
    }
  }
  ```
- **Possible Errors:** `APPOINTMENT_NOT_FOUND`, `ALREADY_CANCELLED`, `UNAUTHORIZED_ACTION`.

---

### 3.8. `reschedule_appointment`
- **Purpose:** Move an existing appointment to a new date and time.
- **Confirmation Required:** `true` (Agent must confirm the new date/time slot before executing).
- **Authorization Requirements:** Authenticated patient session.
- **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "appointment_id": { "type": "integer" },
      "new_date": { "type": "string", "description": "YYYY-MM-DD" },
      "new_time": { "type": "string", "description": "HH:MM" }
    },
    "required": ["appointment_id", "new_date", "new_time"]
  }
  ```
- **Output Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "appointment_id": { "type": "integer" },
      "doctor_name": { "type": "string" },
      "old_date": { "type": "string" },
      "new_date": { "type": "string" },
      "new_time": { "type": "string" },
      "status": { "type": "string", "example": "rescheduled" }
    }
  }
  ```
- **Possible Errors:** `APPOINTMENT_NOT_FOUND`, `SLOT_UNAVAILABLE`, `PAST_DATE`.

---

### 3.9. `list_services`
- **Purpose:** List medical tests, consultations, and examinations with pricing.
- **Confirmation Required:** `false`
- **Authorization Requirements:** Public / None.
- **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "category": { "type": "string", "description": "Optional category filter" }
    }
  }
  ```
- **Output Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "services": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": { "type": "integer" },
            "name": { "type": "string" },
            "price": { "type": "number" },
            "description": { "type": "string" }
          }
        }
      }
    }
  }
  ```
- **Possible Errors:** None.

---

### 3.10. `get_service_information`
- **Purpose:** Retrieve in-depth preparation details and pricing for a service.
- **Confirmation Required:** `false`
- **Authorization Requirements:** Public / None.
- **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "service_id": { "type": "integer" }
    },
    "required": ["service_id"]
  }
  ```
- **Output Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "id": { "type": "integer" },
      "name": { "type": "string" },
      "description": { "type": "string" },
      "price": { "type": "number" },
      "preparation_instructions": { "type": "string" }
    }
  }
  ```
- **Possible Errors:** `SERVICE_NOT_FOUND`.

---

### 3.11. `create_support_ticket`
- **Purpose:** File a customer support ticket for inquiries that cannot be resolved automatically.
- **Confirmation Required:** `true` (Confirm subject and issue summary with patient).
- **Authorization Requirements:** Patient ID.
- **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "patient_id": { "type": "integer" },
      "subject": { "type": "string" },
      "description": { "type": "string" },
      "priority": { "type": "string", "enum": ["low", "normal", "high"], "default": "normal" }
    },
    "required": ["patient_id", "subject", "description"]
  }
  ```
- **Output Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "ticket_id": { "type": "integer" },
      "status": { "type": "string", "example": "open" },
      "created_at": { "type": "string" }
    }
  }
  ```
- **Possible Errors:** `VALIDATION_FAILED`.

---

### 3.12. `get_ticket_status`
- **Purpose:** Look up the current status and notes on an existing support ticket.
- **Confirmation Required:** `false`
- **Authorization Requirements:** Patient ID & Ticket ID.
- **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "ticket_id": { "type": "integer" }
    },
    "required": ["ticket_id"]
  }
  ```
- **Output Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "ticket_id": { "type": "integer" },
      "subject": { "type": "string" },
      "status": { "type": "string" },
      "last_updated": { "type": "string" }
    }
  }
  ```
- **Possible Errors:** `TICKET_NOT_FOUND`.

---

### 3.13. `transfer_to_human`
- **Purpose:** Escalate and transfer the live conversation/call to a human clinic receptionist.
- **Confirmation Required:** `false` (Triggered on patient explicit request, high frustration, or emergency indicators).
- **Authorization Requirements:** None.
- **Input Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "reason": {
        "type": "string",
        "description": "Summary of reason for transfer (e.g. 'Patient requested human', 'Complex medical inquiry')."
      },
      "urgency": {
        "type": "string",
        "enum": ["routine", "urgent", "emergency"],
        "default": "routine"
      },
      "conversation_summary": {
        "type": "string",
        "description": "Brief 1-2 sentence context summary for the human operator."
      }
    },
    "required": ["reason", "conversation_summary"]
  }
  ```
- **Output Schema:**
  ```json
  {
    "type": "object",
    "properties": {
      "transferred": { "type": "boolean" },
      "queue_id": { "type": "string" },
      "estimated_wait_seconds": { "type": "integer" },
      "handoff_message": { "type": "string" }
    }
  }
  ```
- **Possible Errors:** `TRANSFER_QUEUE_UNAVAILABLE`.
