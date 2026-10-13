# Doctor availability review notes

Date: 2026-10-14. User approved commit and Oracle deployment on 2026-10-14.
Implementation commit `c53cf91` is deployed with migration `0004_scheduling`.

## What changed

| File/module | Responsibility |
|---|---|
| `database/migrations/versions/0004_scheduling.py` | Adds closures, doctor time off, appointments and appointment history; validates slots and prevents duplicate scheduled doctor/patient slots |
| `scheduling_models.py` | Typed database mappings for those four tables |
| `slot_rules.py` | Shared deterministic Cairo time calculations and empty-day reasons |
| `packages/schemas/src/clinic_schemas/availability.py` | Strict date ranges, time filters and public response shapes |
| `availability.py` | Reads schedules and occupancy in batches, then generates and sorts slots |
| `availability_routes.py`, `app.py` | Public endpoints, sanitized errors and public rate limiting |
| `settings.py`, `docker-compose.yml` | One-hour notice and 30-day horizon configuration |
| `seed.py`, `database/seed/scheduling.json` | Explicit optional fictional closures/time off; no seeded patients or bookings |
| Availability/schema/seed tests and CI smoke | Verify time boundaries, filtering, privacy, constraints and private runtime access |

## Review the API

The current isolated Docker review instance is at `http://localhost:8003/docs`.
It uses a separate synthetic database, not the shared Oracle database.
Use `/docs` in the new backend, or request:

```text
GET /api/v1/doctors/1/availability?from_date=2026-10-15
GET /api/v1/availability/search?from_date=2026-10-15&to_date=2026-10-21&earliest_time=10:00&latest_time=14:00&limit=5
```

Choose dates within the current booking window. Dates are Cairo calendar dates;
lead and horizon limits compare exact UTC instants, including clock changes.
Ranges contain at most seven inclusive dates. Filters require strict `HH:MM`:
earliest is inclusive, latest exclusive. Doctor and specialty filters intersect.
Results sort by start instant and then doctor ID before limiting. Names include
English and Arabic, suitable for the later Egyptian Arabic agent interface.

Empty-day reasons follow this precedence: clinic closure/Friday, doctor does not
work or all shift time is off, no candidate inside the booking window, then all
remaining candidates booked. Only `scheduled` appointments occupy slots.
Patient identity, contact details, visit reasons and internal leave reasons are
never included. Public reads cannot evaluate patient-specific booking limits.

Availability is a snapshot. This increment adds no appointment-write endpoints.
The next increment must recheck availability inside a transaction, implement
patient ownership, daily/active limits, history and idempotency, and test races.

## Optional local demo seed

```powershell
python -m alembic upgrade head
python -m clinic_backend.seed --scheduling-file database/seed/scheduling.json
```

An optional `--scheduling-base-date YYYY-MM-DD` makes fixtures reproducible;
otherwise offsets use today's Cairo date. Existing rows are preserved. Nothing
seeds automatically when the API starts. Do not run the demo seed on Oracle.

## Deployment after review

Back up the shared database first. Build the paired backend image, retain the
current image and configuration, then run `alembic upgrade head` using the
migration owner with `DATABASE_SCHEMA=clinic`. Existing `clinic_runtime` must
already be provisioned. Revision 0004 enables RLS and backend-only policies on
the four new tables, revokes PUBLIC/anon/authenticated table access and grants
the runtime role table/sequence access. It does not expose the private schema
through Supabase's Data API.

Start the paired new backend, verify readiness and both public endpoints, then
test using synthetic data. Existing OTP delivery settings remain required.
Readiness checks the exact migration head: do not upgrade the shared database
while leaving the old image serving requests. Coordinate a short maintenance
window or a controlled image/database cutover.

Rollback before any booking records exist: stop the new backend, downgrade to
`0003_identity`, then restore the old image. Downgrade drops all four new tables;
once data exists, retain the schema and use a forward repair or restore the
backup under an agreed recovery plan.

## Verification

Full suite: 108 passed against local PostgreSQL. Ruff, Black, strict mypy,
repository validation and Compose syntax passed. Fresh Docker migration to
0004, optional synthetic seed, readiness and bilingual availability/search
smoke passed. Fresh code review found no unresolved critical/important issues.
The implementation is committed and pushed; GitHub CI status has not been verified in this deployment session.

## Oracle deployment record — 2026-10-14

- Deployed exact implementation commit `c53cf91046c6b2ebf122bf29b45cfb409d3a1740`.
- Clean release directory: `/home/ziad/clinic-releases/c53cf91`. The earlier
  server checkout was preserved because it contains prior deployment edits.
- Active image: `clinic-backend:c53cf91`, container healthy.
- Protected backup: `/home/ziad/clinic-cutover/availability-c53cf91` contains
  the pre-migration clinic dump/checksum, preserved configuration and metadata.
  Previous image retained as `clinic-backend:before-availability-c53cf91`.
- Briefly paused only the clinic backend. Exact row counts/content fingerprints
  for all existing clinic tables matched before and after migration.
- All four new tables have RLS and runtime permissions; anon/authenticated lack
  table access and clinic schema usage. No scheduling demo seed ran on Oracle.
- Readiness, registration page and bilingual doctor availability/search passed
  on Oracle and through the existing SSH tunnel at `http://localhost:8002/docs`.
  Identity remains enabled and email delivery remains n8n. No test email was sent.
- Existing Compose-format migration credentials required a protected Docker
  env-file normalization because `docker run --env-file` preserves quote marks.
  The initial attempt changed no database objects; the corrected upgrade passed.

For future restarts use the release Compose files plus `deployment.override.yml`,
project name `agentic-call-center`, and the original protected `.env.cutover-base`,
`.env.supabase`, `.env.n8n` under `/srv/team-projects/agentic-call-center`.
Do not redeploy the old checkout accidentally. Runtime credentials remain
separate from the protected migration credentials; backups contain secrets and
patient data and must never be added to Git.
