# Manual Supabase installation

These scripts export the implemented backend at Alembic revision 0003_identity.
Availability/booking tables and endpoints are not implemented by these scripts.
No credentials or actual patient data are included.

1. In Supabase Studio SQL Editor run 00-preflight.sql. If the second result
   contains existing clinic tables, stop and review the result before continuing.
2. For a fresh installation only, run 01-clinic-schema.sql as the database
   administrator. It creates a dedicated clinic schema and the exact committed
   migration history. It intentionally fails if that schema already exists.
3. Run 02-synthetic-catalog.sql. Expected revision: 0003_identity; expected
   counts: five specialties, ten doctors, fifteen services. Seed reruns preserve
   existing rows rather than overwrite them.

Keep clinic out of PostgREST's exposed schemas. All installed tables have RLS
enabled with no browser policies, and anon/authenticated receive no schema/table
access. This does not use Supabase Auth for the existing clinic OTP flow.

Before connecting the backend, configure its PostgreSQL search_path to clinic
and use explicit migration/runtime roles. Runtime role privileges and policies
must be prepared and tested; do not assume a newly created non-owner role can
read/write these RLS-protected tables. The current app defaults to public, so
this installation alone does not connect the local app to the Oracle server.
Do not edit Supabase-managed auth/storage schemas or grant browser roles access
to clinic identity/session tables. Private networking or SSH protects DB access.

Schema SQL was generated with `python -m alembic upgrade head --sql`, wrapped in
a private-schema transaction and access restrictions. Catalog SQL is compiled
from database/seed/catalog.json using the existing seed normalization rules.
Keep future schema changes in Alembic, rather than start a second migration
history in Supabase.
