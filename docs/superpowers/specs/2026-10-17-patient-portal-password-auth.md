# Patient portal password authentication

Status: approved for local implementation, including unique email/phone requirements. Branch: `codex/connect-patient-auth`, based on `3cf9be5`.

## User requirements

- First signup: full name, email, Egyptian/international phone, DOB, password, and email OTP verification.
- Later sign-in: email/password or phone/password; no additional OTP by default.
- Forgot password: enter email, receive a reset link, open the reset page, enter the same email and a new password.
- Preserve the new portal design, Egyptian Arabic/English support, existing patient records and customer numbers.
- Keep the shared server unchanged during implementation and local review.

## Authentication authority and session boundary

Supabase Auth remains the sole password/OTP/recovery authority. Clinic tables never store passwords. The clinic backend proxies the portal's authentication requests and keeps provider credentials out of frontend source. Typed password inputs use secret fields; responses, errors and logs never echo passwords or provider tokens.

The portal is served with the backend under one origin. Successful verification/login sets HttpOnly, SameSite cookies for provider session credentials and the conversation binding. Production cookies require HTTPS and Secure; any HTTP loopback review exception must be explicit and restricted to local development. No password, OTP, access token or refresh token is saved in localStorage/sessionStorage or a URL by the portal. Recovery callback credentials are consumed immediately and removed from browser history before loading other resources.

An authenticated session/profile endpoint validates the provider identity and live Auth session, then returns the minimal patient DTO. Refresh, navigation and logout must use actual provider sessions, never an `authenticated: true` browser flag. Cookie-authenticated writes require an allowed Origin/CSRF protection. All authenticated responses use no-store. Existing service/conversation APIs and the old registration page stay compatible.

## Signup

Validate the complete registration form before requesting email delivery. Normalize Arabic/Persian digits, convert DD/MM/YYYY to an actual calendar date, normalize +20/local Egyptian mobile input to E.164, and require explicit privacy consent. Passwords must be confirmed and satisfy the chosen policy (at least 12 characters, bounded length).

Submit email/password to Supabase signup with email confirmation required. Show the existing six-digit verification screen only after a successful provider response. Pending form state remains in memory; the password is cleared after submission. Resend uses Supabase's signup resend operation, not a second passwordless signup, with cooldown/rate limits.

Verify the email OTP through Supabase, then reuse SupabaseIdentity completion to create/link the clinic patient exactly once. Verification cannot be skipped with a URL hash. Preserve an existing patient's original profile and customer number. Profile-validation failures return to an editable form without pretending authentication completed.

## Email and phone sign-in

Email/password goes to Supabase's password grant. Phone/password first resolves a normalized number to one linked clinic account server-side, then submits that account's email/password to Supabase. Never return an email lookup result to the browser. A phone is a login identifier, not proof of phone ownership; no SMS verification or SMS provider is introduced.

Email and normalized phone numbers must each be unique across all clinic patients, including staff-created records. Preserve the existing case-insensitive email index and add a unique phone index. The migration aborts on pre-existing duplicates without editing patient records. Signup reports EMAIL_ALREADY_REGISTERED or PHONE_ALREADY_REGISTERED, including the requested phone-already-registered message. Unique database constraints remain authoritative during concurrent requests. Unknown login identifiers, wrong passwords and unverified accounts receive generic failures, with bounded identifier/IP rate limits. Existing OTP-only users can use password recovery to set their first password. Password login alone must not create a clinic profile; unlinked users are directed to complete verified registration.

## Forgotten password and recovery

Add dedicated request-reset and set-new-password views matching the portal. Reset requests always show a generic acknowledgment, whether or not the email exists. Use Supabase recovery delivery and an explicit allowlisted callback URL; retain the six-digit signup email template and add a separate recovery-link template.

Opening a valid recovery link establishes only the session needed for the password-change flow. The backend verifies that session with Supabase. The email entered on the reset form must match the verified account; an email alone cannot authorize a reset. Require matching new-password and confirmation fields. Expired, reused or invalid links show a recoverable error and a request-new-link action.

After password update, revoke the relevant provider/clinic sessions and return to sign-in. Old credentials must fail and the new password must work. Do not automatically grant access from an unverified hash, client state flag or user-supplied email. Recovery callbacks must not leak credentials through logs, referrers, analytics, remote images or third-party fonts.

## Frontend integration

Replace simulated handlers and fake Google login/reset success. Keep Google sign-in visibly unavailable until configured. Continue-to-dashboard must use a real authenticated session; the dashboard may retain its existing demo content, but that content must not be described as live patient appointments. Add session-aware entry/logout behavior without silently expanding this task into implementing the complete dashboard.

Show pending, validation, authentication and network errors in both English and Egyptian Arabic, using text-safe rendering. Prevent duplicate submissions. Preserve OTP paste/focus support and Arabic/Persian digit entry. Clear passwords/OTPs after use and clear authenticated state on logout/expiry.

## Contracts, testing and deployment

Add explicit shared DTOs and documented portal auth/session/recovery endpoints. Preserve all existing patient, booking and admin access boundaries. Extend the Auth adapter with password signup/grant, resend, recovery, refresh and password-update operations as needed; no provider admin key goes to the browser.

Test signup/OTP/resend, duplicate completion, email/phone login, ambiguous phone, wrong password, session navigation/expiry/logout, generic unknown-email recovery, callback validation, email mismatch, link expiry/reuse, password change and old-password rejection. Retain the existing integration suite and add executable frontend state tests plus Arabic/English browser checks. Exercise real provider flows with local GoTrue/Mailpit and synthetic data before any live configuration changes.

Use the existing Gmail SMTP configuration for real email acceptance later. Recovery redirect allowlists, templates, production HTTPS/cookie configuration and shared backend rollout are explicit deployment prerequisites to coordinate with Hassan. Do not restart services or change Supabase Auth while implementing this branch.

## Sources

- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/auth/sessions
