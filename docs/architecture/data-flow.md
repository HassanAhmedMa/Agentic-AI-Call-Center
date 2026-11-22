# Conversational and operational data flows

Status: Phase 0 contracts, aligned with proposed ADR-003. Paths are relative to `/api/v1`.

## 1. Public search and verified booking

1. Browser creates a conversation and connects to the text gateway (later, voice WSS). Credentials stay outside model context.
2. Agent uses `find_doctors(query="قلب")` and availability tools with absolute Cairo dates; backend returns bilingual catalog data.
3. If the caller wants a patient action, `request_verification_code(customer_number)` starts a challenge. The browser submits the code directly to `/verification/verify`; no code enters the tool layer. First-time callers use `start_registration` and a direct browser form.
4. The gateway polls authoritative verification state; verified tools become available only for a valid binding.
5. `propose_booking` stores an immutable proposal and returns its summary. Agent delivers doctor, date, time and price; gateway records delivery. A new affirmative caller turn permits `confirm_pending_action`.
6. Dispatcher attaches service/conversation credentials and the proposal-derived idempotency key. Backend resolves identity, locks rows and enforces schedule, cutoff, limits and unique slot constraints in one transaction.
7. Report success only after backend success. Timeouts retain an unknown outcome and reuse the same key until reconciled; no automatic replacement booking.

## 2. Cancellation and rescheduling

Use `get_my_appointments` for owned visits, then `propose_cancellation` or `propose_reschedule` and confirmation. Backend enforces the four-hour cutoff. Rescheduling retains the same doctor and scheduled status, excludes the moved visit from both limit counts and writes history atomically. Failed rescheduling leaves the original unchanged.

## 3. Registration, verification and session lifecycle

Direct browser forms and code submissions bypass STT, LLM and tool logs. Known and unknown identities have the same pending responses. The backend serializes challenge completion, binds a patient session, invalidates other pending challenges and revokes any previous binding. Logout/account switch/end invalidates proposals; disconnect allows five minutes to resume. Expiry is checked per request, including verification polling.

## 4. Informational policies

`search_clinic_knowledge` maps to the RAG service's `/api/v1/rag/retrieve`. Empty/low-confidence passages cause an honest fallback. RAG explains policies; backend enforces booking values. Refunds/payment processing are outside MVP scope, so a four-hour cancellation rule does not imply a refund promise. Prices and available slots come from catalog APIs.

## 5. Human assistance

Predefined safety matching runs before the LLM. `transfer_to_human` uses reason category, urgency and a bounded summary; omit summary/contact/secret values from logs. Phase 1 returns `transferred=false` and reports live transfer unavailable. Phase 2 requires queue and staff-auth contracts before implementation; a queued item does not establish a live staff connection. Emergency guidance remains configured, non-clinical and independent of queue availability.
