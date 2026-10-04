# Logging & Observability Package (`packages/logging`)

Unified structured logging, request tracing, and latency profiling across all services.

## Standards
- **JSON Format:** Logs emitted as structured JSON (e.g. `timestamp`, `level`, `service`, `trace_id`, `message`, `context`).
- **PII Scrubbing:** Automatically filters and masks sensitive patient identifiers, phone numbers, and auth tokens.
- **Trace Context:** Propagates `X-Trace-ID` or OpenTelemetry headers across the Voice Layer ➔ AI Agent ➔ Clinic Backend flow.
