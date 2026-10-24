# Clinic Functional Scope & Domain Model

> **PROJECT:** Agentic Clinic  
> **DOCUMENT:** Clinical Domain Boundaries & Core Entities  
> **PHASE:** Phase 0 Foundation

---

## 1. Context & Clinic Definition

**Agentic Clinic** operates as a controlled, simulated multi-specialty outpatient medical clinic. The domain model captures realistic clinical workflows—such as specialty-based administrative discovery, doctor scheduling, diagnostic services, and patient support—while remaining safely bounded and strictly synthetic for demonstration purposes.

> ⚠️ **Scope Boundary:**  
> - **Synthetic Data Only:** All patient records, phone numbers, and staff names are fictitious.
> - **Billing Scope:** Financial accounting, online payment processing, and insurance pre-authorization are intentionally deferred beyond Phase 0. Pricing information is exposed as a read-only catalog on Services and Doctor consultations.

---

## 2. Core Entities & Attributes

### 2.1. Patient
Represents a recipient of clinic care seeking consultations or medical information.
- **Attributes:**
  - `id`: Unique identifier (integer).
  - `full_name`: Full name, supplied in the browser registration form.
  - `phone`: Primary contact phone number (string, E.164 format).
  - `email`: Required, unique case-insensitively and verified by browser email code.
  - `date_of_birth`: Date of birth (`YYYY-MM-DD`).
  - `gender`: Optional (`male`, `female` in the current schema).
  - `insurance_provider`: Name of affiliated health insurer (e.g. "Misr Insurance", "Allianz").
  - `insurance_policy_number`: Policy/card number.
- **Responsibilities:**
  - Initiates bookings and cancellation requests.
  - Owns past and upcoming appointment history.
  - Submits customer support tickets.

---

### 2.2. Doctor
Represents a medical specialist practicing at the clinic.
- **Attributes:**
  - `id`: Unique identifier (integer).
  - `name_en` / `name_ar`: Stored bilingual name with title (e.g. "Dr. Sarah Farouk").
  - `specialty_id`: Reference to bilingual specialties with normalized synonyms (e.g., Cardiology, Pediatrics, Dermatology, Orthopedics).
  - `title`: Professional rank (e.g., Consultant, Specialist).
  - `description`: Clinical background, subspecialties, and bio.
  - `languages`: Spoken languages (e.g. Arabic, English).
  - `consultation_fee`: Standard consultation fee in EGP.
  - `working_days`: Array of days on duty (e.g., `["Sunday", "Tuesday", "Thursday"]`).
  - `shift_start` / `shift_end`: Clinic shift hours (e.g. `10:00` to `18:00`).
  - Slot duration: fixed aligned 30 minutes; not a per-doctor column.
- **Responsibilities:**
  - Provides consultation slots.
  - Receives appointments within scheduled working days and hours.

---

### 2.3. Appointment
Represents a scheduled clinical visit between a Patient and a Doctor.
- **Attributes:**
  - `id`: Unique appointment ID.
  - `patient_id`: Reference to the patient.
  - `doctor_id`: Reference to the attending doctor.
  - `date`: Date of the visit (`YYYY-MM-DD`).
  - `time`: Scheduled start time (`HH:MM`).
  - `status`: Current lifecycle state (`scheduled`, `completed`, `cancelled`, `no_show`).
  - `visit_reason`: Optional administrative reason, maximum 300 characters; the agent never requests symptoms.
  - `cancellation_reason`: Optional explanation recorded upon cancellation.
- **Responsibilities:**
  - Reserves the doctor's calendar slot atomically.
  - Enforces the invariant: **No two active appointments may overlap for the same doctor or patient.**

---

### 2.4. Service
Represents clinical procedures, examinations, and diagnostic packages.
- **Attributes:**
  - `id`: Unique service ID.
  - `name`: Formal name of the service (e.g., "Echocardiogram", "Complete Blood Count").
  - `category`: Classification (e.g., "Diagnostic", "Laboratory", "Consultation").
  - `description`: Plain-language medical description.
  - `price`: Standard cost (numeric).
  - `duration_minutes`: Estimated procedure duration.
  - `preparation_instructions`: Important instructions for the patient (e.g., fasting requirements).
- **Responsibilities:**
  - Serves as a bilingual API catalog; prices come from the backend, never RAG copies.

---

### 2.5. Support Ticket
Represents an administrative, technical, or customer-care inquiry.
- **Attributes:**
  - `id`: Unique ticket ID.
  - `patient_id`: Reference to the patient filing the ticket.
  - `subject`: Summary title of the issue.
  - `description`: Full details of the complaint or question.
  - `status`: Ticket state (`open`, `in_progress`, `resolved`, `closed`).
  - `priority`: Urgency level (`low`, `normal`, `high`, `urgent`).
  - `created_at`: Timestamp when filed.
  - `updated_at`: Timestamp of latest status update.
- **Responsibilities:**
  - Tracks non-appointment workflows (e.g., billing inquiries, feedback).

ADR-003 defines the current proposed identity and booking model: internal patient ids never select a caller; phone is non-unique contact data, insurance fields are optional and excluded from tool outputs, and customer number only starts verification. See database-schema.md for authoritative column names/types.
