"""Add patient medical profile fields for administrative records."""

from alembic import op

revision = "0007_patient_profile"
down_revision = "0006_idempotency"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE patients
        ADD COLUMN IF NOT EXISTS address VARCHAR(255),
        ADD COLUMN IF NOT EXISTS blood_type VARCHAR(8),
        ADD COLUMN IF NOT EXISTS allergies VARCHAR(512),
        ADD COLUMN IF NOT EXISTS chronic_conditions VARCHAR(512),
        ADD COLUMN IF NOT EXISTS preferred_pharmacy VARCHAR(128),
        ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(128),
        ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(32);
    """)


def downgrade():
    op.execute("""
        ALTER TABLE patients
        DROP COLUMN IF EXISTS emergency_contact_phone,
        DROP COLUMN IF EXISTS emergency_contact_name,
        DROP COLUMN IF EXISTS preferred_pharmacy,
        DROP COLUMN IF EXISTS chronic_conditions,
        DROP COLUMN IF EXISTS allergies,
        DROP COLUMN IF EXISTS blood_type,
        DROP COLUMN IF EXISTS address;
    """)
