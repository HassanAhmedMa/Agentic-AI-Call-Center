-- Fresh clinic schema only. Generated from Alembic 0001 through 0003.
-- Run in Supabase SQL Editor as the database administrator.
-- Stop if preflight finds existing clinic tables; do not create duplicate stores.
-- This script is atomic and intentionally refuses a second installation.
BEGIN;
DO $preflight$
BEGIN
 IF EXISTS (
  SELECT 1 FROM pg_tables WHERE schemaname = 'public'
  AND tablename IN ('alembic_version','specialties','doctors','services',
   'patients','conversation_sessions','verification_challenges','patient_sessions',
   'rate_limit_events','appointments','appointment_history','doctor_time_off',
   'clinic_closures')
 ) THEN
  RAISE EXCEPTION 'Existing public clinic tables found. Review before creating a second clinic schema.';
 END IF;
END
$preflight$;
CREATE SCHEMA "clinic";
REVOKE ALL ON SCHEMA "clinic" FROM PUBLIC;
SET LOCAL search_path TO "clinic";
CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL,
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Running upgrade  -> 0001_catalog

CREATE TABLE specialties (
    id BIGSERIAL NOT NULL,
    name_en VARCHAR(128) NOT NULL,
    name_ar VARCHAR(128) NOT NULL,
    synonyms TEXT[] DEFAULT '{}' NOT NULL,
    search_terms TEXT[] DEFAULT '{}' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (name_en),
    UNIQUE (name_ar)
);

CREATE INDEX idx_specialties_search_terms ON specialties USING gin (search_terms);

CREATE TABLE doctors (
    id BIGSERIAL NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    title_en VARCHAR(128) NOT NULL,
    title_ar VARCHAR(128) NOT NULL,
    specialty_id BIGINT NOT NULL,
    bio_en TEXT NOT NULL,
    bio_ar TEXT,
    languages TEXT[] DEFAULT '{ar,en}' NOT NULL,
    consultation_fee NUMERIC(10, 2) NOT NULL,
    working_days SMALLINT[] NOT NULL,
    shift_start TIME WITHOUT TIME ZONE NOT NULL,
    shift_end TIME WITHOUT TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT 'true' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ck_doctors_fee CHECK (consultation_fee >= 0),
    CONSTRAINT ck_doctors_days CHECK (cardinality(working_days) > 0 AND working_days <@ ARRAY[1,2,3,4,6,7]::smallint[] AND array_position(working_days, NULL) IS NULL),
    CONSTRAINT ck_doctors_shift_bounds CHECK (shift_start >= TIME '07:00' AND shift_end <= TIME '22:00' AND shift_end > shift_start),
    CONSTRAINT ck_doctors_shift_grid CHECK (EXTRACT(MINUTE FROM shift_start) IN (0,30) AND EXTRACT(SECOND FROM shift_start)=0 AND EXTRACT(MINUTE FROM shift_end) IN (0,30) AND EXTRACT(SECOND FROM shift_end)=0),
    FOREIGN KEY(specialty_id) REFERENCES specialties (id) ON DELETE RESTRICT
);

CREATE INDEX idx_doctors_specialty ON doctors (specialty_id);

CREATE INDEX idx_doctors_active ON doctors (is_active);

CREATE TABLE services (
    id BIGSERIAL NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    category VARCHAR(64) NOT NULL,
    description_en TEXT NOT NULL,
    description_ar TEXT,
    price NUMERIC(10, 2) NOT NULL,
    duration_minutes INTEGER DEFAULT '30' NOT NULL,
    preparation_instructions_en TEXT,
    preparation_instructions_ar TEXT,
    is_available BOOLEAN DEFAULT 'true' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ck_services_price CHECK (price >= 0),
    CONSTRAINT ck_services_duration CHECK (duration_minutes > 0),
    UNIQUE (name_en),
    UNIQUE (name_ar)
);

INSERT INTO alembic_version (version_num) VALUES ('0001_catalog') RETURNING alembic_version.version_num;

-- Running upgrade 0001_catalog -> 0002_conversations

CREATE TYPE conversation_status AS ENUM ('active', 'disconnected', 'ended');

CREATE TABLE conversation_sessions (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    token_hash BYTEA NOT NULL,
    status conversation_status DEFAULT 'active' NOT NULL,
    channel VARCHAR(16) NOT NULL,
    client_ip INET,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    disconnected_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (id),
    CONSTRAINT ck_conversation_channel CHECK (channel IN ('voice', 'text')),
    UNIQUE (token_hash)
);

CREATE INDEX ix_conversation_status_seen ON conversation_sessions (status, last_seen_at);

CREATE TABLE rate_limit_events (
    id BIGSERIAL NOT NULL,
    bucket VARCHAR(48) NOT NULL,
    subject VARCHAR(128) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (id)
);

CREATE INDEX ix_rate_limit_bucket_subject_created ON rate_limit_events (bucket, subject, created_at);

UPDATE alembic_version SET version_num='0002_conversations' WHERE alembic_version.version_num = '0001_catalog';

-- Running upgrade 0002_conversations -> 0003_identity

ALTER TABLE conversation_sessions ADD COLUMN otp_send_count INTEGER NOT NULL DEFAULT 0 CHECK (otp_send_count BETWEEN 0 AND 5);

CREATE TYPE preferred_language AS ENUM ('ar','en');

CREATE TYPE verification_purpose AS ENUM ('login','registration');

CREATE TYPE challenge_status AS ENUM ('pending','verified','failed','expired','superseded');

CREATE TABLE patients (
            id BIGSERIAL PRIMARY KEY,
            customer_number CHAR(6) NOT NULL UNIQUE
                CHECK(customer_number ~ '^[0-9]{6}$'),
            full_name VARCHAR(255) NOT NULL, email VARCHAR(254) NOT NULL,
            email_verified_at TIMESTAMPTZ NOT NULL,
            phone VARCHAR(16) NOT NULL CHECK(phone ~ '^\+[1-9][0-9]{7,14}$'),
            date_of_birth DATE NOT NULL,
            preferred_language preferred_language NOT NULL DEFAULT 'ar',
            gender VARCHAR(16) CHECK(gender IN ('male','female')),
            insurance_provider VARCHAR(128), insurance_policy_number VARCHAR(64),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

CREATE UNIQUE INDEX uq_patients_email ON patients(lower(email));

CREATE INDEX idx_patients_phone ON patients(phone);

CREATE TABLE verification_challenges (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            purpose verification_purpose NOT NULL,
            conversation_session_id UUID NOT NULL
                REFERENCES conversation_sessions(id) ON DELETE CASCADE,
            patient_id BIGINT REFERENCES patients(id) ON DELETE CASCADE,
            pending_registration JSONB, code_hash BYTEA,
            status challenge_status NOT NULL DEFAULT 'pending',
            failed_attempts SMALLINT NOT NULL DEFAULT 0
                CHECK(failed_attempts BETWEEN 0 AND 3),
            client_ip INET, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            expires_at TIMESTAMPTZ NOT NULL, verified_at TIMESTAMPTZ,
            CHECK((purpose='login' AND pending_registration IS NULL)
                OR (purpose='registration' AND patient_id IS NULL)),
            CHECK((status='verified') = (verified_at IS NOT NULL))
        );

CREATE UNIQUE INDEX uq_challenge_pending ON verification_challenges(conversation_session_id,purpose) WHERE status='pending';

CREATE INDEX idx_challenges_patient_time ON verification_challenges(patient_id,created_at);

CREATE TABLE patient_sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            patient_id BIGINT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
            conversation_session_id UUID NOT NULL
                REFERENCES conversation_sessions(id) ON DELETE CASCADE,
            verified_via UUID REFERENCES verification_challenges(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            expires_at TIMESTAMPTZ NOT NULL,
            revoked_at TIMESTAMPTZ, revoke_reason VARCHAR(32)
                CHECK(revoke_reason IN
                    ('call_ended','resume_expired','logout','account_switch','staff'))
        );

CREATE UNIQUE INDEX uq_patient_session_live ON patient_sessions(conversation_session_id) WHERE revoked_at IS NULL;

CREATE INDEX idx_patient_sessions_patient ON patient_sessions(patient_id);

UPDATE alembic_version SET version_num='0003_identity' WHERE alembic_version.version_num = '0002_conversations';

-- Keep clinic tables inaccessible to Supabase browser/Data API roles.
-- No public policies are created; our trusted backend owns patient authorization.
DO $secure$
DECLARE t record; r text;
BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'clinic' LOOP
  EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', 'clinic', t.tablename);
 END LOOP;
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
   EXECUTE format('REVOKE ALL ON SCHEMA %I FROM %I', 'clinic', r);
   EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM %I', 'clinic', r);
   EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM %I', 'clinic', r);
  END IF;
 END LOOP;
END
$secure$;
COMMIT;
