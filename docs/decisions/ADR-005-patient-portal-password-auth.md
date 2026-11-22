# ADR-005: Patient portal password authentication

Status: accepted by user instruction on 2026-10-17; implementation awaiting review.

The approved portal uses email/password plus email OTP on signup, email or unique
phone plus password on subsequent login, and an emailed recovery link. Supabase
Auth owns passwords, OTPs, password resets and provider sessions. The clinic backend
validates Auth identity and private session state, enforces unique patient email
and phone, and binds the clinic profile. Phone remains stored for future workflows;
phone login resolves a linked email privately and does not introduce SMS auth.

Use a same-origin backend facade and HttpOnly cookies, with exact Origin checks
on mutations. Never expose staff/service tokens or persist patient bearer tokens
in browser storage. Reuse existing identity completion, revocation and rate-limit
persistence. No new external dependency is introduced. Preserve existing agent
and OTP-only routes. Migration 0008 aborts on duplicate phones without data repair.

Consequences: production needs HTTPS, an exact redirect allowlist and separate
signup OTP/recovery link email templates. Existing OTP-only accounts can set a
password via recovery. Existing dashboard data remains demo content until a
separate patient dashboard API integration. Shared-server deployment requires
coordination and is outside this local implementation.
