# ADR-003: Patient Identity Verification, Booking Rules, Bilingual Catalog & Browser Call Channel

- **Status:** Proposed (acceptance conditions in §7)
- **Date:** 2026-10-09 (revision 3)
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

### Decision 3.1: Identity model and authorization boundary

**Identifiers** — each has one job:

| Identifier | Purpose | Who sees it |
|---|---|---|
| `patients.id` | Internal database primary key | Backend only. Never shown to the caller or the LLM |
| `customer_number` | Patient-facing account identifier, used only to **start** verification | Caller, agent |
| `email` | Required, unique, verified contact address and destination for verification codes | Browser form and backend only; never returned to the agent |
| Patient session | Establishes **which patient the current operation may access** | Backend only (server-side) |

**Rules**
- The LLM can never select a patient. No patient-data tool accepts `patient_id`, `customer_number` or `email`. The only tool that takes a `customer_number` is `request_verification_code`, which starts a challenge and returns no patient data.
- The backend derives the patient **only from the verified patient session** and enforces ownership on every patient-specific operation. Patient-facing endpoints use `/patients/me/...`; ids supplied in a body or path never override the session.
- **Server-side sessions.** After successful verification, the backend creates a patient session (an opaque random id stored server-side) and binds it to the **conversation session** (created by the backend when the call starts, also an opaque random id). Server-side storage makes revocation immediate. Neither id is ever placed in the LLM context.
- **Two independent checks on every agent request** to the backend:
  1. **Service authentication:** the `AGENT_SERVICE_TOKEN` proves the request comes from our agent service. It grants **no** patient permissions by itself.
  2. **Patient authorization:** the backend looks up the patient session bound to the given conversation session. It must exist, be verified, and not be expired or revoked. The patient comes from that binding.

  Without a valid patient session, public catalog and authenticated conversation/verification/escalation bootstrap operations remain available; patient data and writes do not.

**Roles**

| Role | Who | Can do |
|---|---|---|
| (none) | Anyone | Public info: doctors, specialties, availability, services, opening hours |
| `patient` | Verified registered account (existing, or newly registered during the call, §3.4) | View, book, reschedule, cancel own appointments; create/view own tickets |
| `clinic_staff` | Reception / support staff | Update tickets, view escalations |

There is **no unverified guest role**.

### Decision 3.2: Verification = customer number + one-time code (OTP) by email, entered only in the browser

**Customer number**
- **6 digits**: 5 digits + 1 **Luhn check digit** (e.g. `48213` + check digit `3` → `482133`). The check digit catches a misheard digit before any lookup; the agent asks the caller to repeat it.
- The customer number is an identifier, not a secret, and on its own grants nothing.

**The OTP never passes through the LLM**
- The agent calls `request_verification_code(customer_number)`. The backend creates a **verification challenge** and emails the code. The agent receives only `{state: "pending", delivery: "email_on_file"}`, never the code.
- The response is **identical for known and unknown customer numbers** and contains **no masked email**: a masked address exists only for real accounts, so returning it would reveal which numbers are valid. The agent says: "If this number is registered, we've sent a code to the email on file. Please type it in the box on your screen."
- The **browser code box is the only supported way to enter the code** in the MVP. The page submits it **directly to the backend** verification endpoint with the conversation token and the purpose. There is at most one pending challenge per conversation and purpose, so no challenge id ever passes through the agent or the page. The code never travels through the voice service, speech recognition or the agent.
- **Spoken codes are not accepted.** If a caller reads the code aloud anyway, the agent says "please type it in the box on your screen". While a challenge is open, the voice service **redacts digit sequences** from transcripts before they reach the agent or logs (best effort).
- The code value is **never logged** anywhere: request logging excludes the verification endpoint's body.
- On success, the backend creates the patient session, binds it to the conversation session, and notifies the agent with an event: `{verified: true}`. The agent then continues.

**Challenge binding**
- Each challenge is bound to: **purpose** (`login` | `registration`), **target account** (or pending registration), **conversation session**, and **expiry**.
- A code is valid only for its own challenge. A login code cannot complete a registration, and a code from one conversation session cannot be used in another.

**Code rules**

| Rule | Value |
|---|---|
| Length | 6 digits |
| Validity | 5 minutes |
| Use | Single use; requesting a new code invalidates the previous one |
| Wrong attempts | Max 3 per challenge, then the challenge is invalidated |
| Storage | HMAC-SHA-256 hash with a server secret; never stored in plain text, never logged |

**Rate limits** (all enforced by the backend)

| Limit | Value |
|---|---|
| Codes per customer number | Max 3 per 15 minutes, 60 s between sends |
| Codes per client IP | Max 10 per hour |
| Codes per conversation session | Max 5 |
| Failed verifications per client IP | Max 20 per hour |

- **Client IP** is taken from `X-Forwarded-For` **only** when the request comes from our own configured reverse proxy or tunnel (trusted-proxy list in config). Otherwise the socket address is used, so callers cannot fake their IP with a header.
- **Unknown customer numbers** get the same response as known ones ("If this number is registered, a code has been sent"), so valid numbers cannot be discovered by guessing.

**Email delivery**
- Development and demo use **Mailpit** (local capture server in Docker with a web inbox; it does not deliver to real inboxes). A mobile demo needs controlled access to the synthetic inbox or a configured SMTP provider. The mail sender sits behind an interface so a real SMTP provider can replace it later.

**No date-of-birth authentication**
- Date of birth is **not** an authentication factor in any mode.
- Real email OTP (via Mailpit) is used from **Phase 1** onwards, because Mailpit makes it free and local.
- Automated tests and CI use a **mock verification adapter** that accepts a fixed code for **seeded test accounts only**. It is enabled by `VERIFICATION_PROVIDER=mock` and the backend **refuses to start** if `mock` is configured when `ENVIRONMENT` is not `development` or `test`.
- The verification API contract is identical for the real and mock adapters, so nothing downstream changes.
- Phase 6 hardens what exists (adversarial tests, rate-limit tuning, audit logging); it does not introduce a new authentication method.

**Tiered access:** public information never requires verification. Verification is requested only when the caller wants to view, book, reschedule or cancel.

### Decision 3.3: Session lifecycle

| Item | Rule |
|---|---|
| Conversation session | Created by the backend at call start. Ends when the call ends, or 5 minutes after the connection drops without resume |
| Call-resume window | 5 minutes. Reconnecting within it continues the same conversation session, including its patient session binding |
| Patient session idle timeout | 15 minutes without a patient-scoped request |
| Patient session absolute lifetime | 60 minutes, then re-verification is required |
| End of call / end of resume window | The patient session is **revoked** immediately |
| Caller says "log out" / switches account | The patient session is revoked; a new verification is needed |
| Expiry mid-call | Patient-scoped tools return `SESSION_EXPIRED`. The agent explains and starts a new verification. Public questions keep working |

### Decision 3.4: First-time callers register during the call

**Flow**
1. The caller says they have no customer number. The agent calls `start_registration`, and the call page opens a **registration form**: name, phone, date of birth, email, preferred language.
2. Callers are **never asked to spell an email address aloud**.
3. On submit, the page sends the form **directly to the backend**, which creates a `registration` challenge and emails a code. The caller types it into the code box.
4. When the code is correct, the backend creates the patient, assigns a customer number, emails it, creates the patient session and binds it to the conversation session. The caller can book right away.

**Duplicates and linking**
- **Email** is required and **unique**. If it is already registered, the response is **the same as for a new email** ("code sent"), so the form cannot be used to discover registered addresses. No usable code is created; instead the existing owner receives an email: "Someone tried to register with this address. If it was you, use your customer number to sign in."
- **Phone** is a contact field only. It is **not unique**, so family members can share a number. It is not verified and not used for authentication.
- A new registration is **never automatically linked** to an existing patient based on matching name, phone or date of birth. Merging records is a manual `clinic_staff` task.
- Max **3 registrations per client IP per day**, plus the code rate limits from §3.2.

**What the limits mean:** email verification proves control of an inbox, not real-world identity. All booking limits therefore apply **per registered patient account**. They do not guarantee that one person cannot hold several accounts with different email addresses. For a synthetic demo clinic this is acceptable; reception would check identity on arrival in a real clinic.

**Callers who cannot register** (no email, or cannot use the form): the agent offers `transfer_to_human`. No booking is ever made without a verified patient session.

### Decision 3.5: Booking rules are enforced by the backend

| Rule | Value | Error code |
|---|---|---|
| Slot length | 30 minutes for every doctor (MVP) | `INVALID_SLOT_TIME` |
| Slot alignment | Start times on :00 or :30 within the doctor's shift | `INVALID_SLOT_TIME` |
| Booking horizon | Up to 30 days ahead | `BOOKING_TOO_FAR_AHEAD` |
| Minimum lead time | At least 1 hour from now | `BOOKING_TOO_SOON` |
| Cancel / reschedule notice | At least 4 hours before the appointment | `CHANGE_WINDOW_CLOSED` |
| Per account per day | Max 2 active appointments, not with the same doctor | `DAILY_LIMIT_REACHED` / `DUPLICATE_DOCTOR_SAME_DAY` |
| Active appointments per account | Max 5 | `ACTIVE_LIMIT_REACHED` |
| Clinic closed | Friday | `CLINIC_CLOSED` |
| Doctor off | Doctor's working days and time off | `DOCTOR_UNAVAILABLE` |

#### Exact rule definitions

**Shared terms**
- **Clinic time:** `Africa/Cairo`, used consistently for every rule.
- **Now:** the current time in clinic time, read from an injectable clock so tests can fix "now" to any moment.
- **Active appointment:** `status = 'scheduled'` **and** its start is later than now. Cancelled, completed and no-show appointments never count, nor do `scheduled` appointments whose start has passed.
- **Account:** one registered patient (`patients.id`). Every limit is counted per account, never per session or browser.

**R1. Schedules and slots**
- Every doctor uses **30-minute slots**. Slots start on :00 or :30 and last exactly 30 minutes.
- Each doctor has their **own weekly schedule**: their own working days and one shift (`shift_start`–`shift_end`), with the same hours on each working day. Shift times are on :00 or :30.
- The last slot must **end** by `shift_end` (shift 10:00–14:00 → last slot 13:30).
- **Per-doctor exceptions** are stored in `doctor_time_off` (a full day or a time range).

**R2. Max 2 appointments per day**
- Per account; counts active appointments on the same clinic-local date, across all doctors; the two must be with different doctors.
- When rescheduling, the appointment being moved is excluded from both the daily count for its new date and the total active count.

**R3. Max 5 active appointments**
- Per account, across all doctors and all future dates.

**R4. Only verified sessions can change appointments**
- Every booking, reschedule and cancellation requires a valid patient session bound to the current conversation session (§3.1).

**R5. 4-hour cutoff for cancel and reschedule**
- Measured from the appointment's start in clinic time, converted to an exact moment: allowed if `appointment_start − now ≥ 4 hours` (exactly 4 hours is allowed).
- For a reschedule, the cutoff applies to the **current** appointment time; the **new** slot must separately satisfy all booking rules.

**R6. Rescheduling is all-or-nothing**
- One database transaction: lock the appointment row, validate the new slot, update date and time, write `appointment_history`.
- If any check fails (slot taken, limits, cutoff, a concurrent booking hitting a unique index), the transaction rolls back. **The original appointment stays exactly as it was**, and the specific error code is returned.
- MVP reschedules stay with the same doctor. Changing doctor = book a new appointment, then cancel the old one, each confirmed by the caller.

**R7. Friday closed**
- Clinic-wide closure, no per-doctor exceptions in the MVP. A doctor's `working_days` may not include Friday; the backend rejects such schedules.
- Other clinic-wide closed days are stored in `clinic_closures`.

**R8. Daylight-saving safety**
- Egypt's clock changes happen around midnight. Doctor shifts must lie within **07:00–22:00**, enforced by a database check, so no bookable slot can fall in a skipped or repeated hour.
- As a safety net, conversion from local date + time to an exact moment rejects nonexistent local times (`INVALID_SLOT_TIME`) and resolves ambiguous ones to the first occurrence.

- Values live in backend configuration (one place), not in constants spread across files.
- The RAG knowledge base explains these rules, but **is never the source of enforcement**. Clinic policy documents must match these values.

### Decision 3.6: Scheduling model and data integrity

- **Time:** appointment dates and times are stored as clinic-local `DATE` + `TIME`. Audit timestamps stay `TIMESTAMPTZ`.
- **Availability:** computed on request from the doctor's working days and shift, minus clinic closures (Friday + `clinic_closures`), minus `doctor_time_off`, minus active appointments, minus slots that break the lead-time or horizon rules. No slot rows are stored.
- **The database enforces the same grid as the backend:**
  - `CHECK (EXTRACT(MINUTE FROM start_time) IN (0, 30) AND EXTRACT(SECOND FROM start_time) = 0)`
  - `CHECK (end_time = start_time + INTERVAL '30 minutes')`
  - Shift checks on `doctors`: times on :00/:30, within 07:00–22:00, `shift_end > shift_start`.
- **Overlap prevention:** because every appointment is exactly one aligned 30-minute slot, the partial unique indexes on `(doctor_id, appointment_date, start_time)` and `(patient_id, appointment_date, start_time)` with `WHERE status = 'scheduled'` prevent all doctor and patient overlaps, including under concurrent requests.
- **Limits under concurrency:** daily and active limits are checked inside the booking transaction while holding a row lock on the patient (`SELECT … FOR UPDATE`), so two simultaneous requests cannot both pass.
- **Known constraint:** these indexes are only sufficient for fixed, aligned 30-minute slots. If variable durations or arbitrary start times are introduced later, the design must switch to range-based exclusion constraints (`btree_gist`) in a new ADR.
- **Status:** `rescheduled` is **removed**. Statuses are `scheduled`, `completed`, `cancelled`, `no_show`. A reschedule updates date and time in place and leaves the status `scheduled`; previous values are stored in `appointment_history`.
- **Cancel endpoint:** `POST /patients/me/appointments/{id}/cancel` replaces `DELETE` with a body.

**Idempotency**
- Write endpoints (book, reschedule, cancel, create ticket) require an `Idempotency-Key` header.
- Keys are **scoped to (patient account, operation)**. The same key used by another account or for another operation is a different key.
- The backend stores a fingerprint of the operation, normalized route target (including appointment id) and validated canonical body with the key. Reusing a key with the **same** request fingerprint returns the original result; reusing it with a **different** request fingerprint returns `422 IDEMPOTENCY_KEY_REUSED`.
- Keys expire after 24 hours.

### Decision 3.7: Bilingual catalog (Arabic + English)

- Doctors, specialties and services store **both** `name_en` and `name_ar`, so the agent reads stored names instead of translating them.
- Specialty becomes a **`specialties` table** (`id`, `name_en`, `name_ar`, `synonyms[]`). Doctors reference it by `specialty_id`. Example: Cardiology / أمراض القلب / {قلب، heart، cardio}.
- Search (`find_doctors`) matches names and synonyms after **Arabic normalization**: أ/إ/آ → ا, ة → ه, ى → ي, remove diacritics and tatweel, lowercase Latin.
- Patients store `preferred_language` (`ar` | `en`).

### Decision 3.8: Browser call channel, mobile-first

This extends ADR-002 Decision 2.1.

- The customer reaches the agent through a **web page with a Call button**, on phones and laptops. There is no phone line in the MVP.
- The page is **mobile-first**: call button, live transcript, **code box**, registration form (as a bottom panel on phones).
- **Call resume:** mobile browsers pause the microphone when the user switches apps (e.g. to read the email code). The 5-minute resume window (§3.3) lets the caller continue the same conversation. The page requests a screen Wake Lock during calls.
- **HTTPS** is required for microphone access on phones. Hosting with HTTPS (a server or a tunnel) must exist before mobile testing in Phase 4.
- **Testing:** Phase 4 tests run on **Android and iPhone, over Wi-Fi and 4G**, including speakerphone and earphones.
- **Roadmap update:** Phase 7 "A real call reaches the agent" → "A browser call from a phone reaches the agent". Phase 10 "phone call → AI → backend action" → "browser call (mobile) → AI → backend action".
- A real phone line remains possible later through the `VoiceProvider` abstraction but is **out of MVP scope**. This decision depends on supervisor approval (§6).

### Decision 3.9: Data minimization

- `patients.gender` → optional. `email` → required, unique, verified. `phone` → required contact field, not unique.
- `insurance_provider` and `insurance_policy_number` → optional, and **never returned to the agent**.
- `appointments.notes` → renamed `visit_reason`, optional, max 300 characters. The agent does **not** ask for symptoms (no clinical triage, per ADR-002 Decision 2.4).
- No medical history, diagnoses or national IDs are stored.
- Verification codes, session ids and service tokens are never written to logs or transcripts.

---

## 3. Alternatives Considered

| Alternative | Why not chosen |
|---|---|
| Date of birth as an interim login (Phases 1–5) | Not a real authentication factor, and a temporary mode tends to become the one everyone builds on. Replaced by real email OTP from Phase 1 plus a test-only mock adapter |
| Accepting the OTP spoken aloud | The code would enter speech recognition, transcripts, LLM context and logs. Browser code box only |
| Stateless JWT patient tokens | Harder to revoke at call end, and the token would have to travel through the voice and agent services. Server-side sessions bound to the conversation are simpler and revocable |
| SMS one-time code | Costs money per message and involves Egyptian telecom rules. Email is free and demonstrable with Mailpit |
| National ID spoken aloud | Long digit strings are where speech recognition fails most, and it is sensitive data |
| Voice biometrics | Highly sensitive biometric data, needs consent and legal review; far beyond MVP scope |
| Unverified guest booking (name + phone by voice) | Unverified identity, an extra role, separate limits and merge logic. Verified in-call registration is safer and simpler |
| Unique phone numbers | Prevents family members sharing a number, while adding no security because phone is not verified |
| Automatic linking of new registrations to existing records | Matching name/phone/DOB could attach a stranger to someone else's appointments. Manual merge by staff only |
| Variable slot lengths per doctor | Needs range-overlap constraints and more complex availability logic. Possible after the MVP with a new ADR |
| Keeping `rescheduled` as a status | Mixes history with current state and breaks status filters |
| Real phone line (PSTN) | Cost, telecom regulations and setup time (ADR-002) |

---

## 4. Consequences & Trade-offs

### Positive
- **The core security promise becomes real:** even a fully manipulated LLM cannot access another patient's data, because the patient comes from a server-side session the LLM never sees, and the OTP never reaches the LLM.
- One authentication method from Phase 1 to the demo; no temporary mode to remove later.
- Booking rules are deterministic, testable and enforced by both the backend and database constraints.
- Arabic doctor search is predictable and testable.
- The browser channel enables on-screen registration, a code box and a visible transcript.
- Less personal data stored and exposed.

### Negative
- More Phase 1 work: challenges, sessions, rate limits, idempotency, history and specialties tables, Mailpit setup.
- The web page must exist earlier (code box and registration form) for verification to work end-to-end. Until it exists, the text test interface needs a simple code box too.
- Mid-call email checking adds friction on phones; mitigated by the code box and call resume.
- First-time callers need an email and must fill in a short form; callers who cannot are transferred to reception.
- Limits apply per account; one person with several email addresses can hold several accounts.
- Fixed 30-minute slots are less realistic for some services.
- The proposal and roadmap wording must change (telephony).

---

## 5. Affected Documents

These changes are part of the **same PR** as this ADR; the ADR is not accepted until they are consistent (§7).

| Document | Change |
|---|---|
| `docs/architecture/database-schema.md` | New: `specialties`, `doctor_time_off`, `clinic_closures`, `appointment_history`, `verification_challenges`, `patient_sessions`, `conversation_sessions`, `idempotency_keys`. Changed: `appointment_status` enum without `rescheduled`; both partial unique indexes `WHERE status = 'scheduled'`; slot-grid and shift checks; patients (customer number, unique email, non-unique phone, optional gender/insurance, preferred language); doctors (bilingual names, `specialty_id`); services (bilingual); appointments (`visit_reason`) |
| `docs/architecture/api-contracts.md` | New: verification challenge + verify endpoints (browser-facing), registration endpoints, `/patients/me/...`, `POST /patients/me/appointments/{id}/cancel`, `Idempotency-Key`, service + session auth headers, full error-code catalog. Removed: `rescheduled` in filters and example responses |
| `docs/architecture/tool-schemas.md` | Remove `patient_id` from all inputs; add `request_verification_code`, `start_registration`; no tool accepts or returns an OTP; remove `rescheduled` from outputs |
| `docs/diagrams/04-data/state-appointment.mmd` (+ rendered images) | Remove the `Rescheduled` state; reschedule is a self-transition on `Scheduled` |
| `docs/diagrams/04-data/entity-relationship-diagram.mmd` | New tables and changed columns |
| `docs/architecture/data-flow.md` | Backend-enforced cancellation rule; verification and registration flows |
| `docs/product/requirements.md` | REQ entries for verification, registration, sessions and booking rules; REQ-PAT-01 "lookup by `patient_id`" removed for the agent |
| `docs/architecture/voice-architecture.md` | Mobile-first page, call resume, code box, transcript redaction during open challenges |
| `.env.example` | Add `VERIFICATION_PROVIDER`, `AGENT_SERVICE_TOKEN`, `OTP_*`, `SMTP_*`, `TRUSTED_PROXIES`, session timeouts |
| `docker-compose.yml` | Add Mailpit service |
| Roadmap (Phase 7, Phase 10) | Browser call wording (§3.8) |
| `docs/decisions/README.md` | ADR-003 in the index (done) |

---

## 6. Open Items

| Item | Blocks | Owner |
|---|---|---|
| **Supervisor confirmation** that a mobile browser call replaces the phone line promised in the proposal. If refused, the channel decision (§3.8) is revisited and telephony is scoped deliberately | Acceptance of this ADR | Team lead (to assign) |
| Team review of booking-rule values (§3.5); values are configurable | Phase 1 booking implementation | Omar + Ziad |
| Owner for the web page (call UI, code box, registration form) | Phase 2 end-to-end verification | Suggested: Bishoy |

---

## 7. Acceptance Checklist

This ADR moves from **Proposed** to **Accepted** only when every item is checked in the PR:

- [ ] Supervisor has confirmed the browser call channel (§6)
- [ ] `database-schema.md` updated: no current `rescheduled` status (historical change notes may explain its removal); indexes use `WHERE status = 'scheduled'`; grid and shift checks present; new tables present
- [ ] `api-contracts.md` updated: no patient ids from clients on patient-facing endpoints; verification is browser-to-backend; idempotency semantics defined; error-code catalog complete
- [ ] `tool-schemas.md` updated: no tool accepts `patient_id`, `customer_number` (except `request_verification_code`) or `email` for patient data; no tool accepts or returns an OTP
- [x] Appointment state diagram and ER diagram updated
- [x] Repository search shows no remaining current `rescheduled` status in docs, diagrams or tests (historical explanations are allowed)
- [ ] `.env.example` and `docker-compose.yml` updated (Mailpit, verification provider, trusted proxies)
- [x] Mock verification adapter is documented as test-only, with the startup guard
- [ ] At least one teammate other than the author has approved the PR


## 8. Review clarifications (2026-10-10)

The companion contracts now clarify proposal delivery/turn checks and replay, idempotency route targets and atomic persistence, conversation-bound client-IP rate limiting, concurrent registration/session replacement, challenge cleanup FKs and seven-inclusive-date search ranges. Rate limits count all identities equally and are checked atomically. Backend values remain configurable; the 30-minute database grid is structural.

The same PR includes the 19-tool catalog, affected source/rendered diagrams, browser form/control flows, Mailpit configuration, requirements/traceability and an implementation roadmap. Staff queue authentication must be contracted in Phase 2 alongside escalation rather than waiting until Phase 6. In Phase 1 handoff is unavailable and must be reported truthfully.

These corrections do not record supervisor approval, team approval of booking values or teammate PR approval. The ADR remains **Proposed**. Full implementation starts only after the relevant acceptance gates are resolved. OTP transcript redaction is best effort; it cannot guarantee that a caller never speaks a code to an STT provider, and direct raw-audio-to-LLM providers need a separate isolation review.
