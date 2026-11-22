# Doctor Availability Implementation Plan

> For agentic workers: use superpowers:executing-plans to implement this plan task by task. Execution remains in this chat; no independent worker dispatch is requested.

**Goal:** Return accurate public doctor availability and earliest-slot search in
English/Arabic, ready for subsequent transactional booking.

**Architecture:** Generate slots on request from existing doctor schedules,
closure/time-off records and scheduled appointments. Share one pure time-rule
module between both read endpoints and future booking validation. Retain the
existing FastAPI/asyncpg/Alembic stack and private Supabase clinic schema.

**Tech stack:** Existing Python 3.11+, Pydantic, SQLAlchemy, PostgreSQL and tzdata.

**Spec:** ../specs/2026-10-13-availability-design.md; API contract sections 5.4/5.5;
database contract sections 4.3/4.4/4.7/4.8.

## Global constraints

- Fixed 30-minute slots on :00/:30, inside 07:00–22:00 and the doctor's shift.
- Africa/Cairo local schedule dates; compare exact UTC instants for time rules.
- At least exactly one hour's notice; at most exactly thirty elapsed days ahead.
- Friday and configured closures closed; time off excludes overlapping slots.
- Maximum seven inclusive query dates; search limit five by default, maximum twenty.
- Time filters apply to slot starts: lower inclusive, upper exclusive.
- Return both doctor names and no patient/contact/visit-reason information.
- No appointment-write endpoints, staff schedule editing or slot reservations.
- Keep deployed Oracle revision 0003_identity unchanged until review. No commits
  until user approval; plan/spec changes are also left for review.

## Review focus

- Clock changes between query date and now must not shift lead/horizon boundaries.
- Occupied slots must disappear only for scheduled appointments; cancellation frees them.
- Range overflow near date.max must fail validation rather than produce a server error.
- Deterministic ties across doctors must preserve earliest-slot order before limiting.
- New tables in Supabase must have explicit RLS/runtime access; local tests alone
  cannot prove non-owner production permissions.

### Task 1: Scheduling persistence

Files: create database/migrations/versions/0004_scheduling.py and
services/clinic-backend/src/clinic_backend/scheduling_models.py; modify
database/migrations/env.py; create tests/integration/test_scheduling_schema.py.

Interfaces: models ClinicClosure, DoctorTimeOff, Appointment, AppointmentHistory
registered with existing Base. Frozen migration imports no live ORM definitions.
Use exact columns, enums, FKs, checks and indexes from the database contract.

- [x] Write regressions proving all four tables exist after a fresh upgrade and
  previous 0003 rows survive upgrade. Reject Friday, off-grid, wrapped/incorrect
  duration slots and inconsistent cancellation fields. Partial indexes reject a
  second scheduled doctor slot/patient slot, while a cancelled slot can be reused.
- [x] Run the tests and confirm failure before implementing migration/models.
- [x] Implement the frozen revision plus models; register metadata imports.
- [x] For current_schema()=clinic, require the existing clinic_runtime role,
  enable RLS on new tables and add backend-only policies/sequence grants. Keep
  Supabase managed schemas unchanged. Test with a non-owner role in isolation.
- [x] Run schema tests with TEST_DATABASE_URL using isolated PostgreSQL schemas.

### Task 2: Typed queries and pure slot generation

Files: create packages/schemas/src/clinic_schemas/availability.py,
services/clinic-backend/src/clinic_backend/slot_rules.py and
tests/unit/test_availability.py; modify backend settings and Compose configuration.

Interfaces: AvailabilityQuery(from_date, to_date), SearchQuery(date fields,
doctor_id, specialty_id, earliest_time, latest_time, limit); response models
DoctorAvailability(doctor_id, slot_minutes, days) and AvailabilitySearch(results).
Pure dataclasses Schedule, TimeOff and SlotDay; generate_day(schedule, date,
now, lead_minutes, horizon_days, closure, time_off, occupied) -> SlotDay.
slot_instant(date, time) -> datetime in UTC, rejecting nonexistent/ambiguous times.

- [x] Write tests with Thursday 2026-10-15, shift 10:00–14:00: last start is
  13:30; time off 12:00–13:00 removes 12:00/12:30 but keeps boundary-adjacent slots.
  Friday 2026-10-16 closes; full-day time off yields DOCTOR_UNAVAILABLE.
- [x] Test start == now+1h allowed, one microsecond earlier excluded; start ==
  now+30 elapsed days allowed, one microsecond later excluded. Cover Cairo offsets
  before/after October's clock change without assuming the machine timezone.
- [x] Validate seven dates allowed/eight rejected, reversed/malformed/overflow
  dates rejected, :00/:30 start/end rules, strict HH:MM filters and ID bounds.
  Both optional doctor/specialty filters intersect; document this interpretation.
- [x] Run red tests, implement typed validation/time helpers and BOOKING_MIN_LEAD_MINUTES
  (60)/BOOKING_HORIZON_DAYS (30) validated settings, rerun green tests.
- [x] Empty-day precedence: clinic closed; no shift/full time off; no candidate
  inside booking window; otherwise all candidates occupied -> FULLY_BOOKED.
  Mixed partial time off and occupancy must not incorrectly label the whole day off.

### Task 3: Public API and search

Files: create backend availability.py, availability_routes.py and
tests/integration/test_availability.py; modify app.py.

Interfaces: Availability(session: AsyncSession, settings: Settings,
clock: Callable[[], datetime]); doctor(doctor_id, query) -> DoctorAvailability;
search(query) -> AvailabilitySearch. availability_router(sessions, settings,
clock) mounts existing documented paths. Use one now value for each request.

- [x] Write PostgreSQL/API tests for no-auth access, bilingual doctor results,
  unknown/inactive doctor 404, malformed/unknown/duplicate query parameters 400,
  empty ranges/reasons and date-range limits.
- [x] Test sorted cross-doctor results by exact instant then doctor id, limiting
  after filtering, lower-inclusive/upper-exclusive time filters and filter intersection.
  Occupied fixtures use only synthetic patients and scheduled appointment records.
- [x] Run red tests. Fetch doctor schedules, closures, time off and appointments
  using bounded set-based queries (no query per slot). Compute availability with
  Task 2's helper. Preserve existing error envelope and no response PII.
- [x] Mount endpoints and include /api/v1/availability in public limiter coverage.
  Return only schema-approved fields; no placeholder booking functionality.
- [x] Run API tests, then the complete catalog/conversation/identity suite.

### Task 4: Reviewable demo, documentation and checks

Files: database/seed/scheduling.json, backend seed.py,
docs/development/phase1-availability-changes.md; update API/database implementation
markers, backend README/AGENTS, implementation roadmap and CI smoke checks.

- [x] Add explicit opt-in synthetic closure/time-off seed input with future
  demo dates selected at execution time; never run it on API startup, overwrite
  existing schedules or seed actual patient bookings. Test repeatable loading.
- [x] Document exact endpoints, empty-day reasons, filter intersection, freshness
  limitations, new tables and changes needed for later booking transactions.
- [x] Run Ruff, Black, strict mypy, repository validation, full PostgreSQL tests
  and git diff --check. Build the Docker image; migrate/seed a fresh isolated DB
  and smoke both availability endpoints in English/Arabic catalog context.
- [x] Prepare private-schema deployment/rollback steps; do not apply them to
  Oracle or interrupt the current image/readiness before user review.
- [x] Link local API examples and changed-file summary for review. Keep all work
  uncommitted; commit/deployment are separate user decisions.

Execution notes: implementation and focused PostgreSQL tests completed; fresh review found no unresolved major defects. Docker fresh migration/optional seed and bilingual API smoke passed on a dedicated local database/API (8003). Final full suite: 108 passed; lint/format/types/repository/Compose checks passed. Verification is recorded in the local execution ledger. All changes remain uncommitted and Oracle remains at 0003.
