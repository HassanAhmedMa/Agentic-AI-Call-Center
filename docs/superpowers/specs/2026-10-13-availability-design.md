# Doctor availability design

Date: 2026-10-13. Status: proposed implementation design.

## Intent and approved rules

Build the next Phase 1 increment: public, deterministic availability in Arabic
and English, ready for later transactional appointment writes. The user approved
the proposed rule values and selected Supabase as the shared database platform.
Oracle access and migration are now verified: the backend uses Supabase PostgreSQL
17.6, database postgres, private clinic schema and restricted clinic_runtime role.
Patient OTP through the authenticated n8n workflow was verified on 2026-10-14.
The user requested proceeding to availability after committing email delivery.

Thirty-minute slots start on :00/:30 and finish inside each doctor's daily shift.
Each doctor has one shift, identical on their working weekdays, between 07:00
and 22:00 Cairo time. Friday and configured clinic closure dates are closed.
Full-day and partial-day doctor time off exclude overlapping slots.
Booking notice is at least exactly one hour; the horizon includes exactly
now + 30 elapsed days. Compare timezone-aware UTC instants after converting
local Cairo slots, including clock transitions. Invalid or ambiguous local
instants must never become bookable.

Later writes enforce two upcoming appointments per patient per day with different
doctors, five total upcoming appointments, and no doctor or patient overlaps.
Changes require at least exactly four hours' notice; rescheduling keeps the same
doctor. Public availability cannot enforce patient-specific limits.

## Interfaces and behavior

Implement the existing API contracts, sections 5.4 and 5.5:

- GET /api/v1/doctors/{doctor_id}/availability: from_date required, to_date
  defaults to from_date, maximum seven inclusive dates. Unknown/inactive doctor
  returns DOCTOR_NOT_FOUND. Return slot_minutes=30 and each requested day's slots
  and empty-day reason according to the documented response.
- GET /api/v1/availability/search: optional specialty_id/doctor_id, same date
  range, optional HH:MM earliest/latest start-time filters, default limit five
  and maximum twenty. Lower time bound is inclusive; upper is exclusive.
  Order by exact slot instant then doctor id for deterministic ties. Include
  both doctor names; return no patient information.
- Strict query validation, existing error envelope and public rate limiting.
  Invalid dates/ranges/unknown parameters return 400 VALIDATION_FAILED.

Availability is computed on request; no materialized slot table and no temporary
reservations. Exclude scheduled occupied slots. Empty-day precedence is closure,
doctor not working/time off, outside booking window, then fully booked, aligned
with the final documented examples. Availability and future writes must share
one slot-rule implementation so boundaries cannot diverge.

## Persistence and code boundaries

Keep the existing FastAPI, SQLAlchemy/asyncpg and Alembic stack. Extend frozen
migrations with a new revision; do not alter previously applied revisions.
Add clinic_closures, doctor_time_off, appointments and appointment_history using
the existing database contract. Appointment storage includes structural aligned
slot checks, patient/doctor foreign keys and partial unique indexes for scheduled
doctor/patient slots. Do not expose appointment writes in this increment.

Use focused availability schemas, scheduling models, a pure slot-rule module,
a database availability service and public routes. Load relevant schedules,
exceptions and occupied appointments in bounded queries rather than per-slot
queries. Inject a clock for deterministic boundary tests. Keep closures/time off
as read-only synthetic seed data; staff schedule mutation belongs to later work.

## Supabase deployment boundary

The backend remains the only public authority for patient identity and database
mutations. Preserve the working email OTP implementation; no switch to Supabase
Auth or browser database access is included. The currently connected plugin
account does not prove access to the Oracle-hosted instance. Do not create or
modify any project in that account as a substitute.

Use the server's PostgreSQL connection through private networking or SSH/VPN.
Prefer a dedicated, unexposed clinic schema with explicit role privileges;
inspect the existing server database and Data API configuration before choosing
the final schema/role setup. Preserve Supabase-managed auth/storage schemas.
Alembic remains the single clinic migration history; do not introduce competing
Supabase migration files. No server migrations or seeds until target and access
are verified. Keep credentials in ignored configuration and out of documentation.

Local PostgreSQL development and isolated-schema integration tests continue.
Prepare the new private-schema grants/RLS alongside the migration. Do not apply
the new revision to Oracle until this increment is reviewed; deployed readiness
requires the image and database migration heads to match.

## Acceptance

- Fresh migration/seed works and existing catalog/identity tests remain green.
- Exact one-hour and thirty-day boundaries, last slot ending at shift end,
  Friday/holiday/full-day/partial time off and occupied slots are tested.
- Cairo clock changes and UTC comparisons are tested without workstation timezone
  dependence. Search ordering, bilingual names and exclusive upper time bound work.
- Invalid ranges/dates/filters and unknown/inactive doctor errors match contracts.
- Tests use synthetic data and real PostgreSQL constraints in isolated schemas.
- Ruff, Black, strict mypy, repository validator and Docker smoke pass.
- User can inspect API results locally; changes remain uncommitted for review.

## Review boundary

Keep implementation uncommitted and the current Oracle service unchanged until
review. The migration contains no real patient seeds or changes to existing OTP
records. Existing credentials stay in protected server configuration.
