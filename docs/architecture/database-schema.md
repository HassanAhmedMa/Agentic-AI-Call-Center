# Database Schema Blueprint

> **PROJECT:** Agentic Clinic  
> **ENGINE:** PostgreSQL 16+  
> **STATUS:** Phase 1 Contract (implements [ADR-003](../decisions/ADR-003-patient-identity-booking-rules-and-channel.md))  
> **ACCESSIBILITY:** Strictly internal to `services/clinic-backend`. **NO DIRECT LLM ACCESS.**

---

## 1. Entity-Relationship Overview

**Implementation status (2026-10-14):** migrations 0001–0003 are implemented and deployed to the private Oracle/Supabase clinic schema. Revision 0004 is prepared locally for review: clinic closures, doctor time off, appointments and appointment history, with slot checks, scheduled-slot uniqueness and backend-only private-schema RLS. Appointment writes, ticket/idempotency tables remain planned. Synthetic scheduling seeds are opt-in and contain no patients/bookings. See [availability review notes](../development/phase1-availability-changes.md). The full target schema is not yet deployed.

```
                         ┌──────────────┐
                         │ specialties  │
                         └──────┬───────┘
                                │ 1
                                │ *
┌──────────────┐  1     * ┌─────▼────────┐ 1     * ┌──────────────────┐
│   patients   ├──────────┤ appointments ├─────────┤     doctors      │
└──┬───┬───┬───┘          └──────┬───────┘         └────────┬─────────┘
   │   │   │                     │ 1                        │ 1
   │   │   │                     │ *                        │ *
   │   │   │             ┌───────▼─────────────┐   ┌────────▼─────────┐
   │   │   │             │ appointment_history │   │ doctor_time_off  │
   │   │   │             └─────────────────────┘   └──────────────────┘
   │   │   │ 1
   │   │   └──────* support_tickets
   │   │ 1
   │   └──────────* patient_sessions *──────1 conversation_sessions
   │ 1                                               │ 1
   └──────────────* verification_challenges *────────┘

Independent:  services · clinic_closures · idempotency_keys · rate_limit_events
```

**Domain tables:** `specialties`, `doctors`, `doctor_time_off`, `clinic_closures`, `services`, `patients`, `appointments`, `appointment_history`, `support_tickets`.

**Identity & safety tables (ADR-003):** `conversation_sessions`, `patient_sessions`, `verification_challenges`, `idempotency_keys`, `rate_limit_events`.

**Deferred to a later PR:** `staff_users` (clinic staff login for the dashboard) and a general `audit_log` (Phase 6). Until then, `appointment_history` is the audit trail for appointments.

---

## 2. Global Conventions

1. **Clinic time.** `appointment_date`, `start_time`, `end_time`, shifts and closures are **clinic-local (`Africa/Cairo`)** `DATE` / `TIME` values. All other timestamps are `TIMESTAMPTZ`.
2. **Slot grid.** Every appointment is exactly **30 minutes**, starting on **:00 or :30**. The database enforces this with `CHECK` constraints (§4.7), in addition to backend validation.
3. **Weekdays** are stored as ISO day numbers: `1` = Monday … `5` = **Friday** … `7` = Sunday.
4. **Bilingual text.** Names shown to callers have `_en` and `_ar` columns.
5. **Secrets are never stored in plain text.** Session tokens and verification codes are stored only as hashes (`BYTEA`).
6. **Naming.** `snake_case`, plural table names, primary key `id`, foreign keys `<entity>_id` (see `coding-standards.md`).
7. **Business rule values** (30-day horizon, 4-hour cutoff, daily limits, etc.) live in backend configuration. The database enforces only **structural** invariants that can never change without a migration.

---

## 3. Enum Types

**Implementation status:** migrations `0002_conversations` and `0003_identity`
implement conversation/rate-limit and patient/session/challenge tables.
Appointments, tickets and idempotency tables remain future work.

```sql
CREATE TYPE appointment_status AS ENUM (
    'scheduled',   -- Booked and upcoming (also after a reschedule)
    'completed',   -- Patient attended
    'cancelled',   -- Cancelled by patient or clinic
    'no_show'      -- Patient did not attend
);

CREATE TYPE appointment_event AS ENUM (
    'created',
    'time_changed',     -- Reschedule: date/time moved, status unchanged
    'cancelled',
    'completed',
    'marked_no_show'
);

CREATE TYPE actor_type AS ENUM ('patient', 'clinic_staff', 'system');

CREATE TYPE ticket_status   AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE ticket_priority AS ENUM ('low', 'normal', 'high', 'urgent');

CREATE TYPE preferred_language AS ENUM ('ar', 'en');

CREATE TYPE verification_purpose AS ENUM ('login', 'registration');

CREATE TYPE challenge_status AS ENUM (
    'pending',     -- Code sent, waiting for input
    'verified',    -- Correct code entered (single use, now consumed)
    'failed',      -- Too many wrong attempts
    'expired',     -- Validity window passed
    'superseded'   -- A newer code was requested for the same session + purpose
);

CREATE TYPE conversation_status AS ENUM ('active', 'disconnected', 'ended');
```

> There is **no** `rescheduled` appointment status. A reschedule changes `appointment_date` / `start_time` / `end_time` in place, keeps `status = 'scheduled'`, and writes a `time_changed` row to `appointment_history`.

---

## 4. Table Specifications

### 4.1. `specialties`

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGSERIAL` | `PRIMARY KEY` | |
| `name_en` | `VARCHAR(128)` | `NOT NULL UNIQUE` | e.g. `Cardiology` |
| `name_ar` | `VARCHAR(128)` | `NOT NULL UNIQUE` | e.g. `أمراض القلب` |
| `synonyms` | `TEXT[]` | `NOT NULL DEFAULT '{}'` | Spoken / dialect terms, e.g. `{قلب, heart, cardio}` |
| `search_terms` | `TEXT[]` | `NOT NULL DEFAULT '{}'` | **Normalized** forms of names + synonyms, written by the backend (ADR-003 §3.7) |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |

**Indexes:** `idx_specialties_search_terms` — GIN on `search_terms`.

> Normalization (أ/إ/آ → ا, ة → ه, ى → ي, remove diacritics and tatweel, lowercase Latin) is done in **one backend function** and applied both when writing `search_terms` and when searching, so both sides always match.

---

### 4.2. `doctors`

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGSERIAL` | `PRIMARY KEY` | |
| `name_en` | `VARCHAR(255)` | `NOT NULL` | e.g. `Dr. Sarah Farouk` |
| `name_ar` | `VARCHAR(255)` | `NOT NULL` | e.g. `د. سارة فاروق` |
| `title_en` | `VARCHAR(128)` | `NOT NULL` | e.g. `Consultant Cardiologist` |
| `title_ar` | `VARCHAR(128)` | `NOT NULL` | |
| `specialty_id` | `BIGINT` | `NOT NULL REFERENCES specialties(id) ON DELETE RESTRICT` | |
| `bio_en` | `TEXT` | `NOT NULL` | |
| `bio_ar` | `TEXT` | `NULL` | Optional Arabic bio |
| `languages` | `TEXT[]` | `NOT NULL DEFAULT '{ar,en}'` | Spoken languages (ISO codes) |
| `consultation_fee` | `NUMERIC(10,2)` | `NOT NULL CHECK (consultation_fee >= 0)` | EGP |
| `working_days` | `SMALLINT[]` | `NOT NULL` | ISO weekdays, e.g. `{6,7,1,2,3}` |
| `shift_start` | `TIME` | `NOT NULL` | Clinic-local |
| `shift_end` | `TIME` | `NOT NULL` | Clinic-local |
| `is_active` | `BOOLEAN` | `NOT NULL DEFAULT TRUE` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |

**Constraints**
```sql
-- Working days: at least one, valid ISO days, never Friday (ADR-003 R7)
CHECK (cardinality(working_days) > 0
       AND working_days <@ ARRAY[1,2,3,4,6,7]::SMALLINT[]),

-- Shift on the :00/:30 grid, inside 07:00–22:00 (ADR-003 R1, R8)
CHECK (shift_start >= TIME '07:00' AND shift_end <= TIME '22:00'),
CHECK (shift_end > shift_start),
CHECK (EXTRACT(MINUTE FROM shift_start) IN (0, 30) AND EXTRACT(SECOND FROM shift_start) = 0),
CHECK (EXTRACT(MINUTE FROM shift_end)   IN (0, 30) AND EXTRACT(SECOND FROM shift_end)   = 0)
```

**Indexes:** `idx_doctors_specialty` on `specialty_id`; `idx_doctors_active` on `is_active`.

> The Phase 0 column `slot_duration_minutes` is **removed**: slot length is fixed at 30 minutes for every doctor (ADR-003 R1).

---

### 4.3. `doctor_time_off`

Per-doctor exceptions: a full day off, or a time range on one day.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGSERIAL` | `PRIMARY KEY` | |
| `doctor_id` | `BIGINT` | `NOT NULL REFERENCES doctors(id) ON DELETE CASCADE` | |
| `off_date` | `DATE` | `NOT NULL` | Clinic-local date |
| `start_time` | `TIME` | `NULL` | `NULL` together with `end_time` = full day off |
| `end_time` | `TIME` | `NULL` | |
| `reason` | `VARCHAR(255)` | `NULL` | Internal note, never read to callers |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |

**Constraints**
```sql
CHECK ((start_time IS NULL AND end_time IS NULL)
    OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time
        AND EXTRACT(MINUTE FROM start_time) IN (0, 30) AND EXTRACT(SECOND FROM start_time) = 0
        AND EXTRACT(MINUTE FROM end_time)   IN (0, 30) AND EXTRACT(SECOND FROM end_time)   = 0))
```

**Indexes:** `idx_time_off_doctor_date` on `(doctor_id, off_date)`.

> Adding time off does **not** cancel existing appointments automatically. Staff must handle affected bookings; the backend reports them when time off is created.

---

### 4.4. `clinic_closures`

Clinic-wide closed dates in addition to the weekly Friday closure (e.g. public holidays).

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `closure_date` | `DATE` | `PRIMARY KEY` | Clinic-local date |
| `reason_en` | `VARCHAR(255)` | `NOT NULL` | Can be read to callers |
| `reason_ar` | `VARCHAR(255)` | `NOT NULL` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |

---

### 4.5. `services`

Read-only catalog. **Prices exist only here**; RAG documents must not repeat them (ADR-003 §3.5).

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGSERIAL` | `PRIMARY KEY` | |
| `name_en` | `VARCHAR(255)` | `NOT NULL UNIQUE` | |
| `name_ar` | `VARCHAR(255)` | `NOT NULL UNIQUE` | |
| `category` | `VARCHAR(64)` | `NOT NULL` | `consultation`, `diagnostic`, `laboratory`, … |
| `description_en` | `TEXT` | `NOT NULL` | Plain-language description, no medical advice |
| `description_ar` | `TEXT` | `NULL` | |
| `price` | `NUMERIC(10,2)` | `NOT NULL CHECK (price >= 0)` | EGP |
| `duration_minutes` | `INT` | `NOT NULL DEFAULT 30 CHECK (duration_minutes > 0)` | Informational only; does not affect slot length |
| `preparation_instructions_en` | `TEXT` | `NULL` | e.g. fasting requirements |
| `preparation_instructions_ar` | `TEXT` | `NULL` | |
| `is_available` | `BOOLEAN` | `NOT NULL DEFAULT TRUE` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |

---

### 4.6. `patients`

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGSERIAL` | `PRIMARY KEY` | **Internal only.** Never returned to callers or the LLM |
| `customer_number` | `CHAR(6)` | `NOT NULL UNIQUE CHECK (customer_number ~ '^[0-9]{6}$')` | Patient-facing id: 5 digits + Luhn check digit (validated by backend) |
| `full_name` | `VARCHAR(255)` | `NOT NULL` | |
| `email` | `VARCHAR(254)` | `NOT NULL` | Verified; unique case-insensitively (index below) |
| `email_verified_at` | `TIMESTAMPTZ` | `NOT NULL` | Set when the registration challenge succeeds |
| `phone` | `VARCHAR(16)` | `NOT NULL CHECK (phone ~ '^\+[1-9][0-9]{7,14}$')` | E.164 contact number. **Not unique, not verified, not used for authentication** |
| `date_of_birth` | `DATE` | `NOT NULL` | Clinic record only. **Not an authentication factor** |
| `preferred_language` | `preferred_language` | `NOT NULL DEFAULT 'ar'` | |
| `gender` | `VARCHAR(16)` | `NULL CHECK (gender IN ('male','female'))` | Optional |
| `insurance_provider` | `VARCHAR(128)` | `NULL` | Optional. **Never returned to the agent** |
| `insurance_policy_number` | `VARCHAR(64)` | `NULL` | Optional. **Never returned to the agent** |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |

**Indexes**
```sql
CREATE UNIQUE INDEX uq_patients_email ON patients (lower(email));
CREATE INDEX idx_patients_phone ON patients (phone);   -- staff lookup only, non-unique
```

**Customer number generation:** the backend picks a **random zero-padded** 5-digit base (00000–99999) (not sequential), appends the Luhn digit, and retries on a unique-constraint conflict. Capacity: 100,000 numbers, enough for the demo.

**Fields visible to the agent** (via the API, after verification): `customer_number`, `first_name` (derived for greeting), `preferred_language`. No masked email or other contact fields.

---

### 4.7. `appointments`

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGSERIAL` | `PRIMARY KEY` | Appointment reference read to the caller |
| `patient_id` | `BIGINT` | `NOT NULL REFERENCES patients(id) ON DELETE RESTRICT` | |
| `doctor_id` | `BIGINT` | `NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT` | |
| `appointment_date` | `DATE` | `NOT NULL` | Clinic-local |
| `start_time` | `TIME` | `NOT NULL` | Clinic-local |
| `end_time` | `TIME` | `NOT NULL` | Always `start_time + 30 min` |
| `status` | `appointment_status` | `NOT NULL DEFAULT 'scheduled'` | |
| `visit_reason` | `VARCHAR(300)` | `NULL` | Optional, administrative. The agent does not ask for symptoms |
| `cancellation_reason` | `VARCHAR(300)` | `NULL` | |
| `cancelled_at` | `TIMESTAMPTZ` | `NULL` | |
| `cancelled_by` | `actor_type` | `NULL` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |

**Constraints**
```sql
-- 30-minute grid (ADR-003 R1, §3.6)
CHECK (EXTRACT(MINUTE FROM start_time) IN (0, 30) AND EXTRACT(SECOND FROM start_time) = 0),
CHECK (end_time = start_time + INTERVAL '30 minutes'),

-- Inside the bookable day window (ADR-003 R8)
CHECK (start_time >= TIME '07:00' AND end_time <= TIME '22:00' AND end_time > start_time),

-- Never on a Friday (ADR-003 R7)
CHECK (EXTRACT(ISODOW FROM appointment_date) <> 5),

-- Cancellation fields are consistent with status
CHECK (
    (status = 'cancelled' AND cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL)
    OR
    (status <> 'cancelled' AND cancelled_at IS NULL AND cancelled_by IS NULL)
)
```

**Overlap prevention (partial unique indexes)**

Revision 0004 explicitly rejects wrapped TIME intervals and requires both
cancellation fields to be absent for every non-cancelled status. These checks
close loopholes in the earlier SQL shorthand without changing booking policy.

```sql
CREATE UNIQUE INDEX uq_doctor_slot_active
    ON appointments (doctor_id, appointment_date, start_time)
    WHERE status = 'scheduled';

CREATE UNIQUE INDEX uq_patient_slot_active
    ON appointments (patient_id, appointment_date, start_time)
    WHERE status = 'scheduled';
```

**Other indexes:** `idx_appointments_patient_date` on `(patient_id, appointment_date)`; `idx_appointments_doctor_date` on `(doctor_id, appointment_date)`.

**What the database guarantees vs. the backend**

| Rule | Enforced by |
|---|---|
| 30-minute grid, :00/:30, 07:00–22:00, no Friday | Database `CHECK` + backend |
| No doctor or patient double-booking (incl. concurrent requests) | Database unique indexes |
| Inside the doctor's shift and working days, not in time off or a closure | Backend (in the booking transaction) |
| Lead time ≥ 1 h, horizon ≤ 30 days, 4-hour change cutoff | Backend (config values) |
| Max 2 per day (different doctors), max 5 active | Backend, inside a transaction holding `SELECT … FROM patients WHERE id = $1 FOR UPDATE` |

> The unique indexes are sufficient **only** because every appointment is one aligned 30-minute slot. Variable durations would require range exclusion constraints (`btree_gist`) and a new ADR.

---

### 4.8. `appointment_history`

Append-only record of every appointment change.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGSERIAL` | `PRIMARY KEY` | |
| `appointment_id` | `BIGINT` | `NOT NULL REFERENCES appointments(id) ON DELETE CASCADE` | |
| `event` | `appointment_event` | `NOT NULL` | |
| `previous_date` | `DATE` | `NULL` | Set for `time_changed` |
| `previous_start_time` | `TIME` | `NULL` | Set for `time_changed` |
| `new_date` | `DATE` | `NULL` | Set for `created` and `time_changed` |
| `new_start_time` | `TIME` | `NULL` | Set for `created` and `time_changed` |
| `actor` | `actor_type` | `NOT NULL` | |
| `conversation_session_id` | `UUID` | `NULL REFERENCES conversation_sessions(id) ON DELETE SET NULL` | Which call made the change, if any |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |

**Constraints**
```sql
CHECK (event <> 'time_changed'
       OR (previous_date IS NOT NULL AND previous_start_time IS NOT NULL
           AND new_date IS NOT NULL AND new_start_time IS NOT NULL))
```

**Indexes:** `idx_history_appointment` on `(appointment_id, created_at)`.

---

### 4.9. `support_tickets`

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGSERIAL` | `PRIMARY KEY` | Ticket reference read to the caller |
| `patient_id` | `BIGINT` | `NOT NULL REFERENCES patients(id) ON DELETE RESTRICT` | Changed from `CASCADE` for consistency with appointments |
| `subject` | `VARCHAR(255)` | `NOT NULL` | |
| `description` | `TEXT` | `NOT NULL CHECK (length(description) <= 2000)` | |
| `status` | `ticket_status` | `NOT NULL DEFAULT 'open'` | |
| `priority` | `ticket_priority` | `NOT NULL DEFAULT 'normal'` | The agent may set `low`/`normal`/`high`; `urgent` is staff-only |
| `resolution_notes` | `TEXT` | `NULL` | Staff only |
| `created_via` | `actor_type` | `NOT NULL` | `patient` (through the agent) or `clinic_staff` |
| `conversation_session_id` | `UUID` | `NULL REFERENCES conversation_sessions(id) ON DELETE SET NULL` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |

**Indexes:** `idx_tickets_patient` on `patient_id`; `idx_tickets_status` on `status`.

---

### 4.10. `conversation_sessions`

One row per call (or text chat). Created by the backend when the call starts (ADR-003 §3.1, §3.3).

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Internal id |
| `token_hash` | `BYTEA` | `NOT NULL UNIQUE` | SHA-256 of the opaque session token (≥ 32 random bytes) held by the call page and the agent. The token itself is never stored |
| `status` | `conversation_status` | `NOT NULL DEFAULT 'active'` | |
| `channel` | `VARCHAR(16)` | `NOT NULL CHECK (channel IN ('voice','text'))` | |
| `otp_send_count` | `INT` | `NOT NULL DEFAULT 0 CHECK (otp_send_count BETWEEN 0 AND 5)` | Cumulative sends under the conversation lock; preserves the five-total cap after rate-event cleanup |
| `client_ip` | `INET` | `NULL` | For rate limits. Personal data: deleted with the row (§6) |
| `started_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |
| `last_seen_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |
| `disconnected_at` | `TIMESTAMPTZ` | `NULL` | Start of the 5-minute resume window |
| `ended_at` | `TIMESTAMPTZ` | `NULL` | |

**Indexes:** `idx_conversations_status` on `(status, last_seen_at)` for the cleanup job.

---

### 4.11. `patient_sessions`

A verified patient bound to one conversation. The agent never sees any patient session value; the backend resolves it from the conversation (ADR-003 §3.1).

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | |
| `patient_id` | `BIGINT` | `NOT NULL REFERENCES patients(id) ON DELETE CASCADE` | |
| `conversation_session_id` | `UUID` | `NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE` | |
| `verified_via` | `UUID` | `NULL REFERENCES verification_challenges(id) ON DELETE SET NULL` | The challenge that created this session |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |
| `last_activity_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Idle timeout: 15 min (config) |
| `expires_at` | `TIMESTAMPTZ` | `NOT NULL` | Absolute lifetime: `created_at + 60 min` (config) |
| `revoked_at` | `TIMESTAMPTZ` | `NULL` | |
| `revoke_reason` | `VARCHAR(32)` | `NULL CHECK (revoke_reason IN ('call_ended','resume_expired','logout','account_switch','staff'))` | |

**Indexes**
```sql
-- At most one live patient session per conversation
CREATE UNIQUE INDEX uq_patient_session_live
    ON patient_sessions (conversation_session_id)
    WHERE revoked_at IS NULL;

CREATE INDEX idx_patient_sessions_patient ON patient_sessions (patient_id);
```

**Valid session** = `revoked_at IS NULL AND expires_at > now() AND last_activity_at > now() - idle_timeout`. Checked on **every** patient-scoped request.

---

### 4.12. `verification_challenges`

One row per code sent (ADR-003 §3.2, §3.4).

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Internal challenge id; never sent to the page or LLM |
| `purpose` | `verification_purpose` | `NOT NULL` | |
| `conversation_session_id` | `UUID` | `NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE` | A code only works in this conversation |
| `patient_id` | `BIGINT` | `NULL REFERENCES patients(id) ON DELETE CASCADE` | `login`: target account (`NULL` if the customer number was unknown) |
| `pending_registration` | `JSONB` | `NULL` | `registration`: submitted form data until verified. Deleted after use or expiry |
| `code_hash` | `BYTEA` | `NULL` | HMAC-SHA-256 of the code. `NULL` for unknown customer numbers (no email sent, always fails) |
| `status` | `challenge_status` | `NOT NULL DEFAULT 'pending'` | |
| `failed_attempts` | `SMALLINT` | `NOT NULL DEFAULT 0 CHECK (failed_attempts BETWEEN 0 AND 3)` | 3 → `failed` |
| `client_ip` | `INET` | `NULL` | Requesting IP, for rate limits |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |
| `expires_at` | `TIMESTAMPTZ` | `NOT NULL` | `created_at + 5 min` (config) |
| `verified_at` | `TIMESTAMPTZ` | `NULL` | |

**Constraints**
```sql
CHECK ((purpose = 'login'        AND pending_registration IS NULL)
    OR (purpose = 'registration' AND patient_id IS NULL)),
CHECK ((status = 'verified') = (verified_at IS NOT NULL))
```

**Indexes**
```sql
-- Only one open code per conversation and purpose; a new request supersedes the old one
CREATE UNIQUE INDEX uq_challenge_pending
    ON verification_challenges (conversation_session_id, purpose)
    WHERE status = 'pending';

CREATE INDEX idx_challenges_patient_time ON verification_challenges (patient_id, created_at);
```

> **Unknown customer numbers** still create a challenge row (with `patient_id` and `code_hash` `NULL`) so the response and timing look the same as for a real account. Verifying it always fails.

---

### 4.13. `idempotency_keys`

ADR-003 §3.6.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `patient_id` | `BIGINT` | `NOT NULL REFERENCES patients(id) ON DELETE CASCADE` | Scope part 1 |
| `operation` | `VARCHAR(32)` | `NOT NULL CHECK (operation IN ('book_appointment','reschedule_appointment','cancel_appointment','create_ticket'))` | Scope part 2 |
| `idempotency_key` | `VARCHAR(128)` | `NOT NULL` | Client-supplied header value |
| `request_hash` | `BYTEA` | `NOT NULL` | SHA-256 of canonical operation, route target and validated body (§5) |
| `response_status` | `SMALLINT` | `NULL` | `NULL` while the first request is still running |
| `response_body` | `JSONB` | `NULL` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |
| `expires_at` | `TIMESTAMPTZ` | `NOT NULL` | `created_at + 24 h` |

**Primary key:** `(patient_id, operation, idempotency_key)`.

| Situation | Response |
|---|---|
| New key | Insert row, run the operation, store the response |
| Same key, same request fingerprint, finished | Return the stored response |
| Same key, same request fingerprint, still running | `409 IDEMPOTENCY_IN_PROGRESS` |
| Same key, different `request_hash` | `422 IDEMPOTENCY_KEY_REUSED` |

---

### 4.14. `rate_limit_events`

Simple, testable rate limiting in PostgreSQL (no extra infrastructure). Can move to Redis later behind the same interface.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `BIGSERIAL` | `PRIMARY KEY` | |
| `bucket` | `VARCHAR(48)` | `NOT NULL` | e.g. `otp_send:customer`, `otp_send:ip`, `otp_send:conversation`, `otp_fail:ip`, `registration:ip` |
| `subject` | `VARCHAR(128)` | `NOT NULL` | The counted key: customer number, IP, or conversation id |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | |

**Indexes:** `idx_rate_limit_lookup` on `(bucket, subject, created_at)`.

Limit values (ADR-003 §3.2, §3.4) are configuration. Acquire transaction-scoped advisory locks for `(bucket, subject)` in sorted order, check counts/cooldown, then append events atomically. Registration email subjects use a keyed hash of the normalized address. Store no OTPs or raw registration forms in rate-limit events.

---

## 5. Concurrency Rules (backend)

| Operation | Locking |
|---|---|
| Book | Transaction: `SELECT … FROM patients WHERE id = $1 FOR UPDATE` → check limits and availability → `INSERT appointments` → `INSERT appointment_history` |
| Reschedule | Transaction: lock patient row, then `SELECT … FROM appointments WHERE id = $1 FOR UPDATE` → check cutoff, new slot, limits → `UPDATE` date/time → history row. Any failure rolls back; the original is untouched |
| Cancel | Transaction: lock patient row, then appointment row → check ownership, status, cutoff → `UPDATE status` → history row |
| Verify code | Transaction: `SELECT … FROM verification_challenges WHERE id = $1 FOR UPDATE` → check status/expiry/conversation → compare hash (constant-time) → update challenge, create patient session |

A unique-index violation on `appointments` is translated to `409 SLOT_UNAVAILABLE`, never shown as a 500.

---

## 6. Data Retention

| Data | Kept for | Then |
|---|---|---|
| `verification_challenges` | 24 hours | Clear pending form data immediately on use/expiry; delete row at 24 h (session FK becomes NULL) |
| `idempotency_keys` | 24 hours | Deleted |
| `rate_limit_events` | 24 hours | Deleted |
| `patient_sessions` | 30 days | Deleted |
| `conversation_sessions` | 30 days | Deleted (removes `client_ip`) |
| Domain tables | Indefinitely (synthetic demo data) | — |

A scheduled cleanup job in `clinic-backend` performs the deletions.

---

## 7. Migration Rules & Safety Guidelines

1. **Alembic** migrations in `database/migrations/`; one migration per logical change.
2. **No destructive drops** in shared environments; Phase 1 starts from an empty database, so the initial migration creates this schema directly.
3. **Deterministic seed data** in `database/seed/`: synthetic only, fixed ids, fixed random seed. Seeded test accounts used by the mock verification adapter are marked in the seed file, not in the schema.
4. **Connection pooling** via SQLAlchemy async + asyncpg.
5. **Zero raw SQL in the LLM layer.** The LLM receives neither credentials nor connection strings.
6. Required extension: `pgcrypto` (for `gen_random_uuid()` on PostgreSQL < 13 only; built in from 13+). No other extensions in Phase 1.

---

## 8. Changes from the Phase 0 Schema

| Area | Phase 0 | Now | Reason |
|---|---|---|---|
| Appointment status | Included `rescheduled` | Removed; `time_changed` history event instead | ADR-003 §3.6 |
| Unique indexes | `WHERE status IN ('scheduled','rescheduled')` | `WHERE status = 'scheduled'` | Same |
| Slot grid | Not enforced; per-doctor `slot_duration_minutes` | Fixed 30 min, `CHECK` constraints, column removed | ADR-003 R1, §3.6 |
| Friday / day window | Not enforced | `CHECK` on doctors and appointments | ADR-003 R7, R8 |
| Specialty | Free text on doctor | `specialties` table with synonyms | ADR-003 §3.7 |
| Names | English only | `_en` / `_ar` columns | ADR-003 §3.7 |
| Patients | `phone` unique, `gender` required, no customer number | `customer_number`, unique verified `email`, non-unique `phone`, optional `gender`, `preferred_language` | ADR-003 §3.1, §3.4, §3.9 |
| `appointments.notes` | "Symptoms or notes" | `visit_reason` (300 chars, administrative) | ADR-003 §3.9 |
| Ticket FK | `ON DELETE CASCADE` | `ON DELETE RESTRICT` | Consistency with appointments |
| New tables | — | `doctor_time_off`, `clinic_closures`, `appointment_history`, `conversation_sessions`, `patient_sessions`, `verification_challenges`, `idempotency_keys`, `rate_limit_events` | ADR-003 |


## 9. Transaction and cleanup details

`verified_via` is nullable solely for challenge retention: deleting a 24-hour-old challenge must not delete or invalidate the 30-day session audit record. Session creation always initially records its challenge. Wipe `pending_registration` and code material on terminal challenge states; capture needed data before wiping in the registration transaction.

Store unusable login/duplicate-registration challenges with no usable code; compare against a dummy HMAC and apply the same attempt/expiry behavior. Supersede both challenge purposes after successful verification or logout/call end. Before creating a replacement session, revoke any previous binding including an expired one. Serialize these changes by locking the conversation row, then the challenge, then the patient where needed. Patient-scoped mutations lock and revalidate the conversation/session binding before their domain locks so logout/account-switch cannot race an authorized mutation. Use this common order everywhere to avoid deadlocks.

Idempotency keys use the request fingerprint defined in api-contracts §10, including the route target. Reservation, successful mutation, history and replay response commit atomically; failed operations roll back their domain changes. A PostgreSQL lock timeout may yield `IDEMPOTENCY_IN_PROGRESS`; no incomplete reservation is committed independently of its outcome. Exclude the moved appointment from **both** daily and total active counts when rescheduling. Booking, rescheduling and cancellation use the same patient-then-appointment lock order after identity locks.

Clinic closures, schedules and time-off are read-only seeded data in Phase 1. Before adding staff schedule mutations, define their locking and treatment of affected bookings in the staff contract. No such undocumented endpoint is authorized by this schema.
