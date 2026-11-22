# Google patient sign-in implementation plan

**Goal:** Connect the existing Google button to self-hosted Supabase without exposing provider tokens or changing staff workflows.
**Architecture:** Same-origin POST starts PKCE with a ten-minute HttpOnly SameSite=Lax verifier/state cookie. Google redirects through Supabase to the existing auth page. The page removes the code immediately and POSTs it with state to the backend, which exchanges it, validates the user and binds the existing clinic profile. Missing profiles use the existing verified-profile completion flow. Password and recovery routes remain available.
**Tech stack:** FastAPI, existing AuthClient, Supabase GoTrue, vanilla JS; no new dependencies or DB migrations.

- [x] Add failing integration tests for PKCE challenge, state/cookie rejection, profile completion and existing patient login; frontend Google action.
- [x] Implement bounded DTOs, start/exchange endpoints, callback handling, bilingual profile-only UI and feature configuration.
- [x] Run backend integration, frontend, formatting/type and repository checks; update API/setup documentation.
- [ ] Inspect shared containers and config; preserve existing settings and back up protected configuration. Enable only Google provider and exact callback allowlist. Build immutable backend image and cut over only clinic backend.
- [ ] Prepare an additions-only Caddy patch if new endpoints are not allowed; verify public readiness/provider redirects and ask user to complete their Google login.
