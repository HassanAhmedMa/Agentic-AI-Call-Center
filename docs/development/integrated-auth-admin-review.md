# Integrated Auth/admin corrections

Local review branch: `codex/fix-auth-admin-integration`, based on integration commit `0d46577`. No shared-server deployment or restart is part of these corrections.

## Changes

- Patient administration moves to `/api/v1/admin/patients` and `/api/v1/admin/patients/{id}`; `/api/v1/patients/me` remains the verified patient's profile. The admin client translates its patient requests to the new prefix.
- Public availability uses the migrated scheduling schema and scheduled appointment status. Query failures propagate; rollback no longer expires doctor objects and triggers implicit async database loads. Availability uses the injected clock in tests.
- Optional `ADMIN_API_TOKEN` protects patient administration, all `/api/v1/appointments` operations, doctor creation, and realtime broadcast. Unconfigured administration returns 403; missing/incorrect credentials return 401. This token must be separate from the agent service token and OTP HMAC secret.
- Admin WebSockets require the token in the first JSON message within ten seconds, before registering for events. It never appears in the URL. The dashboard waits for the authenticated CONNECTED event before showing a live status.
- The dashboard prompts for the token per page session and keeps it only in memory. Its API cache is also memory-only. Set or clear a token with `ClinicApi.setAdminToken(...)`; changing it clears cached data. Reloading clears the token. No credential is bundled in source.
- The image build checks OTP template readability as the non-root application user. Configuration files receive read permissions; credentials remain outside the image.
- Formatting, imports and types are corrected, and WebSockets is pinned to the verified build version.

## Staff access boundary

This is a temporary shared-development gate, not staff accounts/roles. Generate a distinct random token in protected server configuration, keep access behind SSH/HTTPS, and give it only to authorized test operators. Never use `AGENT_SERVICE_TOKEN` in a browser. Full staff identity, roles, token expiry/revocation and audit remain Phase 2/6 work. Shared backend deployments require coordination and an immutable image tag. Check `sudo docker ps` and occupied ports first, and do not stop other services.

## Before any deployment

Agree on the combined commit with both developers. Back up the database and protected configuration; apply migration 0007 with the migration role. Configure a separate ADMIN_API_TOKEN without committing it. Build under a new image tag, verify readiness and the actual served OTP template, then test both patient registration and admin workflows. Keep the existing service untouched until the team explicitly approves a cutover.
