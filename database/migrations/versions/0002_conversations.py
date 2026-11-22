"""Conversation foundation. Frozen schema; no imports from application models."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "0002_conversations"
down_revision = "0001_catalog"
branch_labels = None
depends_on = None


def upgrade():
    status = pg.ENUM("active", "disconnected", "ended", name="conversation_status")
    status.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "conversation_sessions",
        sa.Column(
            "id",
            pg.UUID(),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("token_hash", sa.LargeBinary(), nullable=False, unique=True),
        sa.Column(
            "status",
            pg.ENUM(name="conversation_status", create_type=False),
            nullable=False,
            server_default="active",
        ),
        sa.Column("channel", sa.String(16), nullable=False),
        sa.Column("client_ip", pg.INET()),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "last_seen_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("disconnected_at", sa.DateTime(timezone=True)),
        sa.Column("ended_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint(
            "channel IN ('voice', 'text')", name="ck_conversation_channel"
        ),
    )
    op.create_index(
        "ix_conversation_status_seen",
        "conversation_sessions",
        ["status", "last_seen_at"],
    )
    op.create_table(
        "rate_limit_events",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("bucket", sa.String(48), nullable=False),
        sa.Column("subject", sa.String(128), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_rate_limit_bucket_subject_created",
        "rate_limit_events",
        ["bucket", "subject", "created_at"],
    )


def downgrade():
    op.drop_table("rate_limit_events")
    op.drop_table("conversation_sessions")
    pg.ENUM(name="conversation_status").drop(op.get_bind())
