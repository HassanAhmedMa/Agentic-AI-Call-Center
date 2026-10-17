"""Require one canonical phone number per patient; never repair data implicitly."""

from alembic import op

revision = "0008_unique_patient_phone"
down_revision = "0007_patient_profile"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""DO $$ BEGIN
      IF EXISTS(SELECT phone FROM patients GROUP BY phone HAVING count(*)>1) THEN
        RAISE EXCEPTION 'Duplicate phones require review before migration';
      END IF;
      END $$""")
    op.execute("CREATE UNIQUE INDEX uq_patients_phone ON patients(phone)")


def downgrade():
    op.drop_index("uq_patients_phone", table_name="patients")
