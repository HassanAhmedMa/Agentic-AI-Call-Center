-- Read-only: run this first and inspect the results before installing.
SELECT current_database(), current_user, version();

SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname = 'clinic'
   OR (schemaname = 'public' AND tablename IN (
       'alembic_version', 'specialties', 'doctors', 'services', 'patients',
       'conversation_sessions', 'verification_challenges', 'patient_sessions',
       'rate_limit_events', 'appointments', 'appointment_history',
       'doctor_time_off', 'clinic_closures'))
ORDER BY schemaname, tablename;
