# ADR-003: Patient Identity Verification, Booking Rules, Bilingual Catalog & Browser Call Channel

- **Status:** Proposed
- **Date:** 2026-10-09
- **Deciders:** Agentic Clinic Team (5 Software Engineering Students)
- **Consulted:** Academic Supervisor (pending — see §6)
- **Related:** [ADR-002](ADR-002-technology-candidates-and-scope-simplification.md), [feasibility-audit.md](../architecture/feasibility-audit.md), [api-contracts.md](../architecture/api-contracts.md), [tool-schemas.md](../architecture/tool-schemas.md), [database-schema.md](../architecture/database-schema.md)

---

## 1. Context & Problem Statement

A review of the Phase 0 contracts before starting Phase 1 found gaps that would either break the project's core security promise or cause bugs in the clinic backend:

1. **The LLM chooses the patient.** Tools such as `book_appointment`, `get_patient_appointments` and `create_support_ticket` take `patient_id` as an LLM-filled argument. A caller who says "I am patient 102" could read or change another patient's data. This contradicts the core rule in `AGENTS.md`: authorization must never depend on the LLM.
2. **No ownership checks and no way to verify a caller.** `GET /patients/{id}/appointments` returns data for any ID. The feasibility audit mentions "JWT with `patient_id` and role", but no endpoint issues such a token.
3. **Incomplete overlap protection.** The unique indexes only catch identical start times. A patient can hold 10:00 with one doctor and 10:15 with another.
4. **`rescheduled` is used as a status.** After a reschedule, the appointment is still simply booked; filtering by `scheduled` silently misses it.
5. **Booking rules exist only as RAG text.** `data-flow.md` quotes "cancel at least 4 hours in advance" as a policy the agent reads out, but the backend does not enforce any timing rule.
6. **No protection against retried writes.** A network retry of `book_appointment` can create two bookings.
7. **English-only catalog.** Doctor names, specialties and services exist only in English, and specialty is free text. Arabic requests such as «عايز دكتور قلب» depend on the LLM translating correctly every time.
8. **More personal data than needed.** `gender` is mandatory, and `insurance_policy_number` is returned to the agent through `get_patient_information`.
9. **Channel conflict.** ADR-002 replaced telephony with a browser call, but the roadmap (Phase 7, Phase 10) and the approved proposal still describe a real phone call. Most users are expected to use a phone, so the browser call must work on mobile.

---

## 2. Decisions

### Decision 3.1: The patient identity always comes from the verified session, never from the LLM

- The backend issues a **signed, short-lived session token (JWT)** after verification. Claims: `sub` (patient id), `role`, `verification_level`, `session_id`, `exp` (30 minutes, renewable during an active conversation).
- Every patient-scoped endpoint reads the patient from the token. Patient ids in paths or bodies are removed from patient-facing endpoints (`/patients/me/...`).
- **No LLM-facing tool accepts `patient_id`.** The tool layer in `services/ai-agent` attaches the session token to backend calls. The token is never placed in the LLM context.
- The agent service also authenticates itself to the backend with a **service credential** (`AGENT_SERVICE_TOKEN`), so only our agent can act on behalf of patients.
- **Roles:**

| Role | Who | Can do |
|---|---|---|
| (none) | Anyone | Public info: doctors, specialties, availability, services, opening hours |
| `patient` | Verified registered customer (existing, or newly registered during the call, §3.3) | View, book, reschedule, cancel own appointments; create/view own tickets |
| `clinic_staff` | Reception / support staff | Update tickets, view escalations |

There is **no unverified guest role**. Every booking belongs to a patient whose email has been verified.

### Decision 3.2: Verification = customer number + one-time code sent by email

**Customer number**
- Every registered patient gets a **6-digit customer number**: 5 digits + 1 **Luhn check digit** (e.g. `48213` + check digit `3` → `482133`).
- The check digit catches a misheard digit from speech recognition **before** any lookup. The agent then asks the caller to repeat instead of looking up the wrong customer.
- The customer number is an identifier, not a secret.

**One-time code (OTP) by email**
- The agent calls `request_verification_code(customer_number)`. The **backend** generates the code and emails it to the address on file. The agent never receives the correct code.
- The agent tells the caller where it was sent, with the email masked: "I sent a code to a\*\*\*@gmail.com".
- The caller **types the code into the code box on the call page** (primary path) or says it aloud (fallback). Typing avoids digit recognition errors and works after returning from the email app (§3.7).

**Code rules**

| Rule | Value |
|---|---|
| Length | 6 digits |
| Validity | 5 minutes |
| Use | Single use |
| Wrong attempts | Max 3, then the code is invalidated |
| Sending limit | Max 3 codes per customer per 15 minutes, 60 s between sends |
| Storage | Hashed (HMAC-SHA-256 with server secret), never stored in plain text, never logged |

- **Unknown customer numbers:** the response does not reveal whether a number exists ("If this number is registered, a code has been sent"). Combined with rate limiting, this prevents someone from guessing valid customer numbers.

**Demo email delivery**
- Development and demo use **Mailpit**, a local fake mail server in Docker with a web inbox. Codes appear on a local page with no real email account and no cost. The mail sender sits behind an interface so a real SMTP provider can replace Mailpit later.

**Phasing (matches the roadmap)**

| Phase | Verification mode |
|---|---|
| Phase 1–5 | `AUTH_VERIFICATION_MODE=dob`: customer number + date of birth. Simple interim mode so the text agent (Phase 2) can work |
| Phase 6 | `AUTH_VERIFICATION_MODE=email_otp`: customer number + email code becomes the default. DOB mode is kept for automated tests only |

Both modes issue the same token, so nothing downstream changes in Phase 6.

**Tiered access:** public information never requires verification. Verification is requested only when the caller wants to view, book, reschedule or cancel.

### Decision 3.3: First-time callers register during the call (no unverified guests)

**Flow**
1. The caller says they have no customer number. The agent calls `start_registration`, and the call page opens a **quick registration form**: name, phone, date of birth, email, preferred language.
2. Callers are **never asked to spell an email address aloud**, because speech recognition is unreliable for addresses, especially in mixed Arabic and English.
3. On submit, the backend sends a one-time code to the email (same code rules as §3.2). The caller types it into the code box.
4. When the code is correct, the backend creates the patient, assigns a **customer number**, emails it, and issues the session token. The conversation continues as a verified `patient`, so the caller can book right away.

**Why no guest booking:** a guest identified only by a spoken phone number is unverified, so one person could hold many slots using different numbers. Requiring a verified email at registration closes that gap, and it removes a whole role, its special limits and the guest-to-registered merge logic.

**Duplicate and abuse checks**
- Email and phone are each **unique** across patients. If either already belongs to a patient, registration is refused and the agent asks the caller to verify with their customer number instead. The response does not reveal which field matched.
- Max **3 registrations per client IP per day**, plus the code sending limits from §3.2.
- Known limitation: one person can still register several times with different email addresses and phone numbers. This takes real effort and every account is verified, so the risk is accepted for the MVP.

**Callers who cannot register** (no email, or cannot use the form): the agent offers `transfer_to_human` so reception can book for them. No booking is ever made for an unverified caller.

**Phasing:** in `AUTH_VERIFICATION_MODE=dob` (Phases 1–5), registration skips the email code so development is not blocked. From Phase 6 (`email_otp`), the email code is required.

### Decision 3.4: Booking rules are enforced by the backend

| Rule | Value | Error code |
|---|---|---|
| Slot length | 30 minutes for every doctor (MVP) | `INVALID_SLOT_TIME` |
| Slot alignment | Start times on :00 or :30 within the doctor's shift | `INVALID_SLOT_TIME` |
| Booking horizon | Up to 30 days ahead | `BOOKING_TOO_FAR_AHEAD` |
| Minimum lead time | At least 1 hour from now | `BOOKING_TOO_SOON` |
| Cancel / reschedule notice | At least 4 hours before the appointment | `CHANGE_WINDOW_CLOSED` |
| Per patient per day | Max 2 active appointments, not with the same doctor | `DAILY_LIMIT_REACHED` / `DUPLICATE_DOCTOR_SAME_DAY` |
| Active appointments per patient | Max 5 | `ACTIVE_LIMIT_REACHED` |
| Clinic closed | Friday | `CLINIC_CLOSED` |
| Doctor off | Doctor's working days and time off | `DOCTOR_UNAVAILABLE` |

#### Exact rule definitions

**Shared terms**
- **Clinic time:** `Africa/Cairo`. Appointment dates and times are stored as clinic-local `DATE` + `TIME`. For comparisons they are converted to timezone-aware datetimes, so daylight-saving changes are handled correctly.
- **Now:** the current time in clinic time, read from an injectable clock so tests can fix "now" to any moment.
- **Active appointment:** `status = 'scheduled'` **and** its start is later than now. Cancelled, completed and no-show appointments never count. Neither do `scheduled` appointments whose start time has already passed.
- **Patient:** one row in `patients`, identified by `patient_id`. Every limit is counted per patient, never per session or browser.

**R1. Schedules and slots**
- Every doctor uses **30-minute slots** (MVP). Slots start on :00 or :30.
- Each doctor has their **own weekly schedule**: their own working days and one shift (`shift_start`–`shift_end`), with the same hours on each working day. Shift times must be on :00 or :30.
- The last slot must **end** by `shift_end` (shift 10:00–14:00 → last slot 13:30).
- **Per-doctor exceptions** are stored in `doctor_time_off` (a full day or a time range, e.g. "Dr. Sarah off 2026-10-20" or "Dr. Sarah off 2026-10-21 12:00–14:00"). Their slots are not offered or bookable.

**R2. Max 2 appointments per day**
- Counted **per patient** (the verified patient from the session token).
- Counts **active** appointments on the same clinic-local date, **across all doctors**.
- The two appointments must be with **different doctors**.
- When rescheduling, the appointment being moved is excluded from the count for its new date.

**R3. Max 5 active appointments**
- Counted **per patient**, **across all doctors and all future dates**.

**R4. Only verified patients can book**
- Every booking, reschedule and cancellation requires a session token for a verified patient (existing customer, or newly registered during the call, §3.3).
- Because every patient has a verified, unique email and a unique phone, the per-patient limits (R2, R3) apply to a real verified identity, not to something the caller can reset.

**R5. 4-hour cutoff for cancel and reschedule**
- Measured from the **appointment's start in clinic time**, converted to an exact moment: allowed if `appointment_start − now ≥ 4 hours` (exactly 4 hours is allowed).
- For a reschedule, the cutoff applies to the **current** appointment time. The **new** slot must separately satisfy the booking rules (lead time ≥ 1 hour, horizon ≤ 30 days, daily and active limits, availability).

**R6. Rescheduling is all-or-nothing**
- A reschedule is **one database transaction**: lock the appointment row, validate the new slot, update the date and time, write `appointment_history`.
- If **any** check fails (slot taken, limits, cutoff, a concurrent booking hitting the unique index), the transaction is rolled back. **The original appointment stays exactly as it was**, and the caller receives the specific error code.
- MVP reschedules stay with the **same doctor**. Changing doctor means booking a new appointment and then cancelling the old one, each confirmed by the caller.

**R7. Friday closed**
- Friday is a **clinic-wide** closure. **No per-doctor exceptions** in the MVP. A doctor's `working_days` may not include Friday, and the backend rejects such schedules.
- Other clinic-wide closed days (e.g. public holidays) are stored in a `clinic_closures` table.
- Per-doctor Friday work could be added later by moving the Friday rule from configuration into doctor schedules.

- Values live in backend configuration (one place), not in code constants spread across files.
- The RAG knowledge base explains these rules in natural language, but **is never the source of enforcement**. Clinic policy documents must match these values.

### Decision 3.5: Scheduling model and data integrity

- **Time:** all appointment dates and times are **clinic-local time (`Africa/Cairo`)**. "Now" for past-date and lead-time checks is computed in `Africa/Cairo`. Audit timestamps stay `TIMESTAMPTZ`.
- **Availability:** computed on request from the doctor's working days and shift, minus clinic closures (Friday + `clinic_closures`), minus the doctor's time off (`doctor_time_off`), minus active appointments, minus slots that break the lead-time or horizon rules. No slot rows are stored.
- **Double-booking:** with a fixed 30-minute grid, the existing unique indexes on `(doctor_id, appointment_date, start_time)` and `(patient_id, appointment_date, start_time)` cover all overlaps. Daily and active limits are checked inside the booking transaction while holding a row lock on the patient (`SELECT … FOR UPDATE`), so two simultaneous requests cannot both pass.
- **Status:** the `rescheduled` status is **removed**. A reschedule updates the date and time in place; the appointment stays `scheduled`. The previous date and time are recorded in a new `appointment_history` table.
- **Statuses:** `scheduled`, `completed`, `cancelled`, `no_show`.
- **Repeated requests:** write endpoints (book, reschedule, cancel, create ticket) accept an `Idempotency-Key` header. The backend stores the key with the first result for 24 hours and returns that same result for a repeat.
- **Cancel endpoint:** `POST /appointments/{id}/cancel` replaces `DELETE` with a body, because some HTTP clients drop DELETE bodies.

### Decision 3.6: Bilingual catalog (Arabic + English)

- Doctors, specialties and services store **both** `name_en` and `name_ar`, so the agent reads stored names instead of translating them each time.
- Specialty becomes a **`specialties` table** (`id`, `name_en`, `name_ar`, `synonyms[]`). Doctors reference it by `specialty_id`. Example: Cardiology / أمراض القلب / {قلب، heart، cardio}.
- Search (`find_doctors`) matches against both names and synonyms after **Arabic normalization**: أ/إ/آ → ا, ة → ه, ى → ي, remove diacritics and tatweel, lowercase Latin.
- Patients store `preferred_language` (`ar` | `en`).

### Decision 3.7: Browser call channel, mobile-first

This extends ADR-002 Decision 2.1.

- The customer reaches the agent through a **web page with a Call button**, on phones and laptops. There is no phone line in the MVP.
- The page is **mobile-first**: call button, live transcript, **code box**, registration form (as a bottom panel on phones).
- **Call resume:** mobile browsers pause the microphone when the user switches apps (e.g. to read the email code). The server keeps the conversation session for **5 minutes**, and the page offers "resume call" to continue where it stopped. The page requests a screen Wake Lock during calls.
- **HTTPS** is required for microphone access on phones. Hosting with HTTPS (a server or a tunnel) must exist before mobile testing in Phase 4.
- **Testing:** Phase 4 tests run on **Android and iPhone, over Wi-Fi and 4G**. Echo/barge-in behaviour is tested on speakerphone and with earphones.
- **Roadmap update:** Phase 7 "A real call reaches the agent" becomes "A browser call from a phone reaches the agent". Phase 10 "phone call → AI → backend action" becomes "browser call (mobile) → AI → backend action".
- A real phone line remains possible later through the `VoiceProvider` abstraction, but it is **out of MVP scope**.

### Decision 3.8: Data minimization

- `patients.gender` → optional. `email` → required and unique (verified at registration).
- `insurance_provider` and `insurance_policy_number` → optional, and **never returned to the agent**.
- `appointments.notes` → renamed `visit_reason`, optional, max 300 characters. The agent does **not** ask for symptoms (no clinical triage, per ADR-002 Decision 2.4).
- No medical history, diagnoses or national IDs are stored.

---

## 3. Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Phone number + date of birth only (permanent) | Weak: both are easy for someone else to know. Kept only as the interim/test mode |
| SMS one-time code | Costs money per message and involves Egyptian telecom rules. Email is free and demonstrable with Mailpit |
| National ID spoken aloud | 14-digit numbers are where speech recognition fails most, and it is sensitive data we would have to store |
| Voice biometrics (recognize the caller's voice) | Biometric data is highly sensitive, needs consent and legal review, and is far beyond MVP scope |
| Unverified guest booking (name + phone by voice) | One person could hold many slots with different phone numbers, and it needs an extra role, separate limits and merge logic. Verified quick registration is safer and simpler |
| Spelling the email address by voice for registration | Unreliable speech recognition for addresses, especially in mixed Arabic and English |
| Variable slot lengths per doctor | Needs range-overlap constraints and more complex availability logic. Can be added after the MVP |
| Keeping `rescheduled` as a status | Mixes history with current state and breaks status filters |
| Real phone line (PSTN) | Cost, telecom regulations and setup time, as analysed in ADR-002 |

---

## 4. Consequences & Trade-offs

### Positive
- **The core security promise becomes real:** even a fully manipulated LLM cannot access or change another patient's data, because identity comes from a token the LLM never sees.
- Booking rules are deterministic, testable and in one place.
- Arabic doctor search is predictable and testable instead of depending on LLM translation.
- The browser channel enables things a phone line cannot: on-screen registration, a typed code box and a visible transcript.
- Less personal data stored and exposed.

### Negative
- More backend work in Phase 1: verification endpoints, token handling, idempotency, history table, specialties table.
- Mid-call email checking adds friction on phones; mitigated by the code box and call resume.
- First-time callers must have an email and fill in a short form before booking. Callers who cannot are transferred to reception.
- Fixed 30-minute slots are less realistic for some services; acceptable for the MVP.
- The approved proposal and the roadmap must be updated (telephony wording).

---

## 5. Affected Documents (follow-up PRs after this ADR is accepted)

| Document | Change |
|---|---|
| `docs/architecture/database-schema.md` | New: `specialties`, `doctor_time_off`, `clinic_closures`, `appointment_history`, `verification_codes`, `idempotency_keys`, `sessions` (or token store). Changed: patients (customer number, required unique email, optional fields, preferred language), doctors (bilingual names, `specialty_id`), services (bilingual), appointments (status enum, `visit_reason`) |
| `docs/architecture/api-contracts.md` | New: verification and registration endpoints; `/patients/me/...`; `POST /appointments/{id}/cancel`; `Idempotency-Key`; full error-code catalog |
| `docs/architecture/tool-schemas.md` | Remove `patient_id` from all LLM inputs; add `request_verification_code`, `verify_identity`, `start_registration` |
| `docs/architecture/data-flow.md` | Replace the "4 hours" RAG-only rule with a backend-enforced rule; add verification flow |
| `docs/product/requirements.md` | Add REQ entries for verification, in-call registration and booking rules |
| `docs/architecture/voice-architecture.md` | Mobile-first page, call resume, code box, HTTPS |
| `.env.example` | Add `AUTH_VERIFICATION_MODE`, `AGENT_SERVICE_TOKEN`, `OTP_*`, `SMTP_*` (Mailpit) |
| `docker-compose.yml` | Add Mailpit service |
| Roadmap (Phase 7, Phase 10) | Browser call wording (§3.7) |
| `docs/decisions/README.md` | Add ADR-003 to the index |

---

## 6. Open Items Before Acceptance

1. **Supervisor confirmation** that a mobile browser call replaces the phone line promised in the proposal.
2. **Team review** of the booking rule values in §3.4 (they are demo values and can be changed in configuration).
3. **Owner for the web page** (call UI, code box, registration form) — suggested: Bishoy, with support as needed.
