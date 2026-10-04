# Synthetic Database Seeds (`database/seed`)

Deterministic synthetic fixtures for local development and test environments.

## Policies
1. **Synthetic Data Only:** Never place real patient names, actual medical IDs, or real phone numbers in this directory.
2. **Deterministic IDs:** Uses fixed primary keys for doctors, services, and test patients to ensure reproducible integration and E2E tests.
3. **Data Scope:**
   - 10+ synthetic Doctors across 5 specialties (Cardiology, Dermatology, Pediatrics, Orthopedics, Internal Medicine).
   - 15+ Clinic Services with realistic pricing and preparation instructions.
   - Demo Patients with phone numbers for conversational testing.
