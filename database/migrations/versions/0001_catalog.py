"""Public synthetic clinic catalog. Frozen schema; never import live ORM models."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "0001_catalog"
down_revision = None
branch_labels = None
depends_on = None


def timestamps(updated=False):
    columns = [
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        )
    ]
    if updated:
        columns.append(
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            )
        )
    return columns


def upgrade():
    op.create_table(
        "specialties",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("name_en", sa.String(128), nullable=False, unique=True),
        sa.Column("name_ar", sa.String(128), nullable=False, unique=True),
        sa.Column("synonyms", pg.ARRAY(sa.Text()), server_default="{}", nullable=False),
        sa.Column(
            "search_terms", pg.ARRAY(sa.Text()), server_default="{}", nullable=False
        ),
        *timestamps(),
    )
    op.create_index(
        "idx_specialties_search_terms",
        "specialties",
        ["search_terms"],
        postgresql_using="gin",
    )
    op.create_table(
        "doctors",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("name_en", sa.String(255), nullable=False),
        sa.Column("name_ar", sa.String(255), nullable=False),
        sa.Column("title_en", sa.String(128), nullable=False),
        sa.Column("title_ar", sa.String(128), nullable=False),
        sa.Column(
            "specialty_id",
            sa.BigInteger(),
            sa.ForeignKey("specialties.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("bio_en", sa.Text(), nullable=False),
        sa.Column("bio_ar", sa.Text()),
        sa.Column(
            "languages", pg.ARRAY(sa.Text()), server_default="{ar,en}", nullable=False
        ),
        sa.Column("consultation_fee", sa.Numeric(10, 2), nullable=False),
        sa.Column("working_days", pg.ARRAY(sa.SmallInteger()), nullable=False),
        sa.Column("shift_start", sa.Time(), nullable=False),
        sa.Column("shift_end", sa.Time(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        *timestamps(True),
        sa.CheckConstraint("consultation_fee >= 0", name="ck_doctors_fee"),
        sa.CheckConstraint(
            "cardinality(working_days) > 0 "
            "AND working_days <@ ARRAY[1,2,3,4,6,7]::smallint[] "
            "AND array_position(working_days, NULL) IS NULL",
            name="ck_doctors_days",
        ),
        sa.CheckConstraint(
            "shift_start >= TIME '07:00' AND shift_end <= TIME '22:00' "
            "AND shift_end > shift_start",
            name="ck_doctors_shift_bounds",
        ),
        sa.CheckConstraint(
            "EXTRACT(MINUTE FROM shift_start) IN (0,30) "
            "AND EXTRACT(SECOND FROM shift_start)=0 "
            "AND EXTRACT(MINUTE FROM shift_end) IN (0,30) "
            "AND EXTRACT(SECOND FROM shift_end)=0",
            name="ck_doctors_shift_grid",
        ),
    )
    op.create_index("idx_doctors_specialty", "doctors", ["specialty_id"])
    op.create_index("idx_doctors_active", "doctors", ["is_active"])
    op.create_table(
        "services",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("name_en", sa.String(255), nullable=False, unique=True),
        sa.Column("name_ar", sa.String(255), nullable=False, unique=True),
        sa.Column("category", sa.String(64), nullable=False),
        sa.Column("description_en", sa.Text(), nullable=False),
        sa.Column("description_ar", sa.Text()),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column(
            "duration_minutes", sa.Integer(), server_default="30", nullable=False
        ),
        sa.Column("preparation_instructions_en", sa.Text()),
        sa.Column("preparation_instructions_ar", sa.Text()),
        sa.Column("is_available", sa.Boolean(), server_default="true", nullable=False),
        *timestamps(True),
        sa.CheckConstraint("price >= 0", name="ck_services_price"),
        sa.CheckConstraint("duration_minutes > 0", name="ck_services_duration"),
    )


def downgrade():
    op.drop_table("services")
    op.drop_table("doctors")
    op.drop_table("specialties")
