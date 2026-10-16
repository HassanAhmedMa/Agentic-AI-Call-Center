"""Patient-scoped retry records for transactional operations."""

from alembic import op

revision = "0006_idempotency"
down_revision = "0005_supabase_identity"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""CREATE TABLE idempotency_keys (
        patient_id BIGINT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        operation VARCHAR(32) NOT NULL CHECK(operation IN
          ('book_appointment','reschedule_appointment','cancel_appointment','create_ticket')),
        idempotency_key VARCHAR(128) NOT NULL, request_hash BYTEA NOT NULL,
        response_status SMALLINT, response_body JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(), expires_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY(patient_id,operation,idempotency_key))""")
    op.execute("CREATE INDEX idx_idempotency_expiry ON idempotency_keys(expires_at)")
    op.execute("ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY")
    op.execute("""DO $$ BEGIN IF current_schema()='clinic' THEN
        REVOKE ALL ON clinic.idempotency_keys FROM PUBLIC;
        IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
          REVOKE ALL ON clinic.idempotency_keys FROM anon; END IF;
        IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
          REVOKE ALL ON clinic.idempotency_keys FROM authenticated; END IF;
        CREATE POLICY backend_access ON clinic.idempotency_keys
          TO clinic_runtime USING(true) WITH CHECK(true);
        GRANT SELECT,INSERT,UPDATE,DELETE ON clinic.idempotency_keys TO clinic_runtime;
        END IF; END $$""")


def downgrade():
    op.execute("""DO $$ BEGIN IF EXISTS(SELECT 1 FROM idempotency_keys
      WHERE expires_at>now()) THEN
      RAISE EXCEPTION 'Preserve active retry records before downgrade';
      END IF; END $$""")
    op.drop_table("idempotency_keys")
