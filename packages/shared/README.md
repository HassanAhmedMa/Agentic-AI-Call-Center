# Shared Utilities Package (`packages/shared`)

Common helper functions, custom domain exception classes, error envelopes, and cross-cutting constants.

## Contents
- **Error Types:** Standard exception hierarchy mapping domain errors to HTTP/JSON error envelopes.
- **Date & Time Helpers:** Standardized timezone handling, date formatting (`YYYY-MM-DD`), and time-slot math.
- **Text Normalization:** Arabic text cleanup (alif/yaa normalization, diacritics stripping) and phone number E.164 parsing.
