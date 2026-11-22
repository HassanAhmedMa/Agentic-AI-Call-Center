"""Add avatar_url column to doctors table.

Revision ID: 0009_doctor_avatar_url
Revises: 0008_unique_patient_phone
Create Date: 2026-11-22
"""

from alembic import op

revision = "0009_doctor_avatar_url"
down_revision = "0008_unique_patient_phone"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE doctors
        ADD COLUMN IF NOT EXISTS avatar_url TEXT;
    """)


def downgrade():
    op.execute("""
        ALTER TABLE doctors
        DROP COLUMN IF EXISTS avatar_url;
    """)
