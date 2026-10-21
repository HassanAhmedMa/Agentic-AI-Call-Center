# Reproduce backend CI without the shared server

GitHub Actions runs Python 3.11 unit/integration tests against its PostgreSQL
service. A second isolated Compose stack checks container migration, SMTP into
Mailpit and bilingual catalog/availability. It uses `docker-compose.ci.yml` with
the base Compose file, never the Supabase server override. The CI database has
synthetic credentials, no published port and temporary memory-backed storage.
Stopping this test stack discards its database; it is not a development data store.

The base file has no dependency on a removed local `database` service and does
not require a server-only external network. Oracle deployments continue to use
their protected external database configuration.

On a disposable checkout, generate ignored identity configuration with
`python scripts/setup_identity_dev.py`, then use this command prefix for CI:

```bash
docker compose -p clinic-ci -f docker-compose.yml -f docker-compose.ci.yml --profile backend
```

Run `config -q`, `build clinic-backend`, `up -d database mailpit`, then
`run --rm clinic-backend python -m alembic upgrade head`,
`run --rm clinic-backend python -m clinic_backend.seed`, and
`up -d clinic-backend`. Run `python scripts/smoke_identity.py` and
`python scripts/smoke_availability.py`. Finish with `down` using the same prefix.

For occupied local ports, set `CI_BACKEND_PORT` and `CI_MAILPIT_HTTP_PORT` in the
chosen ignored env file, and pass matching `--base-url` and `--mailpit-url` to
`smoke_identity.py`; availability also accepts `--base-url`. Use an explicit
`--env-file` with synthetic credentials to avoid inheriting real SMTP/provider
settings. Do not run this stack or cleanup on the shared Oracle server.

Email validation must return a Pydantic validation error for malformed input on
both Python 3.11 and later versions. Python 3.11's standard-library address parser
can raise IndexError for an incomplete domain; the boundary catches it as invalid
input. CI retains the malformed-address regression cases.
