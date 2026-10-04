# Database Schema Blueprint

> **PROJECT:** Agentic Clinic  
> **ENGINE:** PostgreSQL 16+  
> **STATUS:** Phase 0 Architecture Contract  
> **ACCESSIBILITY:** Strictly internal to `services/clinic-backend`. **NO DIRECT LLM ACCESS.**

---

## 1. Entity-Relationship Overview

```
               ┌─────────────┐
               │   Service   │ (Independent catalog)
               └─────────────┘

┌─────────────┐               ┌─────────────┐               ┌─────────────┐
│   Patient   │ 1           * │ Appointment │ *           1 │   Doctor    │
│             ├───────────────┤             ├───────────────┤             │
└──────┬──────┘               └─────────────┘               └─────────────┘
       │ 1
       │
       │ *
┌──────▼──────┐
│SupportTicket│
└─────────────┘
```

- A **Patient** can book many **Appointments** (`1:N`).
- A **Doctor** hosts many **Appointments** (`1:N`).
- An **Appointment** joins exactly one Patient and one Doctor (`M:N` relationship between Patient and Doctor).
- A **Patient** can file many **SupportTickets** (`1:N`).
- **Service** items exist independently as a medical catalog; in future phases, appointments may link to services.

---

## 2. Status Enums & Types

### 2.1. `appointment_status`
```sql
CREATE TYPE appointment_status AS ENUM (
    'scheduled',   -- Booked and confirmed
    'rescheduled', -- Changed to a different slot
    'completed',   -- Patient attended and completed visit
    'cancelled',   -- Cancelled by patient or clinic
    'no_show'      -- Patient did not attend
);
```

### 2.2. `ticket_status`
```sql
CREATE TYPE ticket_status AS ENUM (
    'open',        -- Ticket logged and pending review
    'in_progress', -- Under investigation by support staff
    'resolved',    -- Solution provided
    'closed'       -- Completed and archived
);
```

### 2.3. `ticket_priority`
```sql
CREATE TYPE ticket_priority AS ENUM (
    'low',
    'normal',
    'high',
    'urgent'
);
```

---

## 3. Relational Table Specifications

### 3.1. `patients`
Stores demographic, contact, and insurance records.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGSERIAL` | `PRIMARY KEY` | Unique patient ID |
| `name` | `VARCHAR(255)` | `NOT NULL` | Full legal name |
| `phone` | `VARCHAR(32)` | `NOT NULL, UNIQUE` | E.164 phone format |
| `email` | `VARCHAR(255)` | `UNIQUE` | Email address |
| `date_of_birth` | `DATE` | `NOT NULL` | Date of birth |
| `gender` | `VARCHAR(16)` | `NOT NULL` | `male`, `female`, `other` |
| `insurance_provider` | `VARCHAR(128)` | `NULL` | Name of insurance carrier |
| `insurance_policy_number`| `VARCHAR(64)` | `NULL` | Policy identifier |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Last update timestamp |

**Indexes:**
- `idx_patients_phone` on `phone` (Quick lookup during incoming phone calls).
- `idx_patients_email` on `email`.

---

### 3.2. `doctors`
Medical practitioner profiles and specialties.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGSERIAL` | `PRIMARY KEY` | Unique doctor ID |
| `name` | `VARCHAR(255)` | `NOT NULL` | Full doctor name |
| `specialty` | `VARCHAR(128)` | `NOT NULL` | Medical specialty (e.g. Cardiology) |
| `title` | `VARCHAR(128)` | `NOT NULL` | Professional title (e.g. Consultant) |
| `description` | `TEXT` | `NOT NULL` | Bio and expertise |
| `languages` | `TEXT[]` | `NOT NULL DEFAULT '{"Arabic","English"}'` | Spoken languages |
| `consultation_fee`| `NUMERIC(10,2)`| `NOT NULL CHECK (consultation_fee >= 0)` | Base consultation fee |
| `working_days` | `VARCHAR(16)[]` | `NOT NULL` | Active days (e.g. `{"Monday","Tuesday"}`) |
| `shift_start` | `TIME` | `NOT NULL` | Shift start time (e.g. `09:00`) |
| `shift_end` | `TIME` | `NOT NULL` | Shift end time (e.g. `17:00`) |
| `slot_duration_minutes` | `INT` | `NOT NULL DEFAULT 30 CHECK (slot_duration_minutes > 0)` | Duration per visit |
| `is_active` | `BOOLEAN` | `NOT NULL DEFAULT TRUE` | Active roster status |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Last update timestamp |

**Indexes:**
- `idx_doctors_specialty` on `specialty` (Filters by specialty).
- `idx_doctors_active` on `is_active`.

---

### 3.3. `appointments`
Scheduled appointments and consultations.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGSERIAL` | `PRIMARY KEY` | Unique appointment ID |
| `patient_id` | `BIGINT` | `NOT NULL REFERENCES patients(id) ON DELETE RESTRICT` | Associated patient |
| `doctor_id` | `BIGINT` | `NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT` | Associated doctor |
| `appointment_date` | `DATE` | `NOT NULL` | Date of visit |
| `start_time` | `TIME` | `NOT NULL` | Start time of slot |
| `end_time` | `TIME` | `NOT NULL` | Computed end time of slot |
| `status` | `appointment_status` | `NOT NULL DEFAULT 'scheduled'` | Current status |
| `notes` | `TEXT` | `NULL` | Symptoms or notes |
| `cancellation_reason` | `TEXT` | `NULL` | Reason if cancelled |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Booking timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Last update timestamp |

**Key Constraints & Invariants:**
- `CHECK (end_time > start_time)`: Ensures end time is after start time.
- **Double-Booking Prevention Index:**
  ```sql
  CREATE UNIQUE INDEX uq_doctor_slot_active
  ON appointments (doctor_id, appointment_date, start_time)
  WHERE status IN ('scheduled', 'rescheduled');
  ```
- **Patient Overlap Prevention Index:**
  ```sql
  CREATE UNIQUE INDEX uq_patient_slot_active
  ON appointments (patient_id, appointment_date, start_time)
  WHERE status IN ('scheduled', 'rescheduled');
  ```
- `idx_appointments_patient_date` on `(patient_id, appointment_date)`.
- `idx_appointments_doctor_date` on `(doctor_id, appointment_date)`.

---

### 3.4. `services`
Clinic procedures, consultations, and diagnostic offerings.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGSERIAL` | `PRIMARY KEY` | Unique service ID |
| `name` | `VARCHAR(255)` | `NOT NULL UNIQUE` | Service name |
| `category` | `VARCHAR(128)` | `NOT NULL` | e.g. Diagnostic, Consultation |
| `description` | `TEXT` | `NOT NULL` | Clinical description |
| `price` | `NUMERIC(10,2)`| `NOT NULL CHECK (price >= 0)` | Service fee |
| `duration_minutes` | `INT` | `NOT NULL DEFAULT 30` | Expected duration |
| `preparation_instructions`| `TEXT` | `NULL` | Patient prep guidelines |
| `is_available` | `BOOLEAN` | `NOT NULL DEFAULT TRUE` | Availability flag |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Creation timestamp |

---

### 3.5. `support_tickets`
Customer inquiry and administrative issue management.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGSERIAL` | `PRIMARY KEY` | Unique ticket ID |
| `patient_id` | `BIGINT` | `NOT NULL REFERENCES patients(id) ON DELETE CASCADE` | Associated patient |
| `subject` | `VARCHAR(255)` | `NOT NULL` | Brief topic summary |
| `description` | `TEXT` | `NOT NULL` | Detailed inquiry |
| `status` | `ticket_status` | `NOT NULL DEFAULT 'open'` | Lifecycle status |
| `priority` | `ticket_priority` | `NOT NULL DEFAULT 'normal'` | Urgency rating |
| `resolution_notes`| `TEXT` | `NULL` | Resolution details |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Last update timestamp |

**Indexes:**
- `idx_tickets_patient` on `patient_id`.
- `idx_tickets_status` on `status`.

---

## 4. Migration Rules & Safety Guidelines

1. **No Destructive Drops:** In production-like environments, schema modifications must be backward compatible.
2. **Deterministic Seed Data:** All seeds located in `database/seed/` must be repeatable and synthetic.
3. **Connection Pooling:** `services/clinic-backend` must use connection pooling (e.g. SQLAlchemy with asyncpg or PgBouncer).
4. **Zero Raw SQL in LLM Layer:** The LLM receives neither database credentials nor schema connection strings.
