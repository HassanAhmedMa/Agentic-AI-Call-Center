# Patient portal authentication implementation plan

User authorized inline implementation and database-level unique email/phone. No server deployment or automatic commit.

- [x] Add migration 0008 with duplicate preflight and unique phone index; retain existing email uniqueness. Test duplicate rejection and normalized inputs.
- [x] Add typed portal DTOs, provider adapter methods, origin/CSRF checks, persistent rate limits, and HttpOnly cookie sessions. Reuse clinic identity completion and Auth-session validation. Test signup/verify, login, refresh/logout and generic recovery requests.
- [x] Add recovery callback/password-update flow with verified identity/email match and provider/clinic session invalidation. Test expired/mismatched callbacks and credential changes.
- [x] Replace simulated frontend handlers; validate DOB/Egyptian phones and passwords, retain existing visual layout, add reset screens and Egyptian Arabic/English messages. Add real session-aware dashboard entry/logout and remove fake authentication storage.
- [x] Serve portal assets on the same backend origin, package assets in Docker, add a separate recovery email template and deployment configuration guide. Keep live server configuration unchanged.
- [ ] Run regression suite, lint/format/types, local provider/Mailpit checks and browser review. Report actual evidence and outstanding real-inbox/HTTPS acceptance.


## Verification record

Full regression run: 142 passed, 1 skipped. Later targeted schema checks: 9
passed; targeted portal integration checks: 8 passed; frontend Node tests: 3 passed. CI-scoped Ruff, Black, mypy, repository
validation, Compose validation and the Docker build passed. Container packaging
was checked with network disabled and a non-root user. Browser desktop review
covered English and Egyptian Arabic signup/login labels and RTL layout.

The final live-provider/Mailpit and real-inbox/password-reset acceptance remain
pending. Automatic approval review rejected startup of the isolated local Auth
test container without a specific reason. No shared-server deployment, commit
or push was performed. See the setup guide for coordinated activation.
