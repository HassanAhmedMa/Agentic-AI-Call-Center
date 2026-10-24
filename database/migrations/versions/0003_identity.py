"""Patient identity. Frozen SQL; never imports application models."""

from alembic import op

revision = "0003_identity"
down_revision = "0002_conversations"
branch_labels = None
depends_on = None


def upgrade():
    for statement in [
        "ALTER TABLE conversation_sessions ADD COLUMN otp_send_count INTEGER "
        "NOT NULL DEFAULT 0 CHECK (otp_send_count BETWEEN 0 AND 5)",
        "CREATE TYPE preferred_language AS ENUM ('ar','en')",
        "CREATE TYPE verification_purpose AS ENUM ('login','registration')",
        "CREATE TYPE challenge_status AS ENUM "
        "('pending','verified','failed','expired','superseded')",
        r"""CREATE TABLE patients (
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
        )""",
        "CREATE UNIQUE INDEX uq_patients_email ON patients(lower(email))",
        "CREATE INDEX idx_patients_phone ON patients(phone)",
        """CREATE TABLE verification_challenges (
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
        )""",
        "CREATE UNIQUE INDEX uq_challenge_pending "
        "ON verification_challenges(conversation_session_id,purpose) "
        "WHERE status='pending'",
        "CREATE INDEX idx_challenges_patient_time "
        "ON verification_challenges(patient_id,created_at)",
        """CREATE TABLE patient_sessions (
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
        )""",
        "CREATE UNIQUE INDEX uq_patient_session_live "
        "ON patient_sessions(conversation_session_id) WHERE revoked_at IS NULL",
        "CREATE INDEX idx_patient_sessions_patient ON patient_sessions(patient_id)",
    ]:
        op.execute(statement)


def downgrade():
    for name in ["patient_sessions", "verification_challenges", "patients"]:
        op.drop_table(name)
    for name in ["challenge_status", "verification_purpose", "preferred_language"]:
        op.execute("DROP TYPE " + name)
    op.drop_column("conversation_sessions", "otp_send_count")
