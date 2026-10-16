"""Add Supabase associations without changing existing clinic identifiers."""

from alembic import op

revision = "0005_supabase_identity"
down_revision = "0004_scheduling"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE patients ADD COLUMN supabase_user_id UUID UNIQUE")
    op.execute("ALTER TABLE patient_sessions ADD COLUMN supabase_session_id UUID")


def downgrade():
    op.execute("""DO $$ BEGIN
      IF EXISTS(SELECT 1 FROM patients WHERE supabase_user_id IS NOT NULL) THEN
        RAISE EXCEPTION 'Preserve Auth associations before downgrade';
      END IF; END $$""")
    op.drop_column("patient_sessions", "supabase_session_id")
    op.drop_column("patients", "supabase_user_id")
