# Chat appointment integration

Integrated with Hassan's UI commit f9e1bf2. The existing Antigravity provider and model configuration are retained. Appointment operations call authenticated backend HTTP APIs; the model receives no database credentials.

## Tools and behavior

- get_patient_context: verified first name and language.
- list_my_appointments: owned upcoming appointments.
- get_doctor_availability: live date-specific slots.
- check_slot_conflict: patient calendar overlap.
- recommend_best_slot: available slots adjoining existing visits, excluding overlaps and duplicate doctor/day visits.
- propose_booking, propose_reschedule, propose_cancellation: prepare an immutable five-minute proposal without saving.
- confirm_pending_action: require a later affirmative turn, interpreted with the exact pending action, then invoke deterministic backend validation and idempotent mutation.

Browser endpoints are POST /api/v1/portal/chat/message, /chat/propose-booking, /chat/propose-change and /chat/confirm-booking. The latter paths share the /api/v1/portal prefix. Authentication, ownership, availability and conflict validation stay on the backend. Old confirmation buttons carry a proposal fingerprint and cannot confirm a replacement action.

## History and UI

Completed messages and structured widgets are retained by patient and thread in this browser's localStorage. Creating a new chat preserves previous chats; navigation restores cards and slot controls. History is not synchronized across devices. The old unscoped v1 storage is preserved but is not automatically assigned to a patient because its owner cannot be verified.

Suggested buttons use readable month names without before/after labels. Confirmation cards identify doctor, department, date and time. Pending requests show activity; confirmation prevents repeated clicks. Successful changes show green status cards.

Pending model proposal context is process-local and expires after five minutes. The deployment must retain the existing single worker. Restarting the backend invalidates unfinished proposals; saved appointments and browser history remain. Shared durable proposal storage is future work.

## Verification

Run from the repository root in PowerShell:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/unit -q
# TEST_DATABASE_URL must reference an isolated disposable test database.
.\.venv\Scripts\python.exe -m pytest tests/integration -q
node --test tests/frontend/*.test.cjs
.\.venv\Scripts\python.exe -m mypy
.\.venv\Scripts\python.exe -m ruff check services/clinic-backend/src packages/schemas/src tests/unit tests/integration database/migrations
.\.venv\Scripts\python.exe -m black --check services/clinic-backend/src packages/schemas/src tests/unit tests/integration database/migrations
docker compose --profile backend build clinic-backend
```

The optional scripts/smoke_chat_ui.cjs uses Playwright with intercepted synthetic APIs, checking mobile layout, month labels, doctor identity, restored widgets and thread history. PLAYWRIGHT_MODULE and CHROME_PATH can select an existing installation.

A live Antigravity smoke test with simulated appointment APIs completed booking, rescheduling and cancellation in six natural-language turns, approximately 3-4 seconds per turn. This validates provider orchestration separately from database tests; it does not represent real patient writes.

## Deployment impact

httpx is now a runtime dependency; the Docker build verifies that the application imports. No database migration, server port, Caddy change, or application environment value is required. Rebuild only clinic-backend. Keep the previous immutable image and deployment manifest for rollback. Preserve the current Supabase connections, networks, cookies, provider configuration and single-worker command. Never print runtime credentials.
