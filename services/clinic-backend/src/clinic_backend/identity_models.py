from datetime import date, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    LargeBinary,
    SmallInteger,
    String,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ENUM, INET, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from clinic_backend.models import Base


class Patient(Base):
    __tablename__ = "patients"
    __table_args__ = (
        CheckConstraint("customer_number ~ '^[0-9]{6}$'", name="ck_patient_number"),
        CheckConstraint("phone ~ '^\\+[1-9][0-9]{7,14}$'", name="ck_patient_phone"),
        CheckConstraint("gender IN ('male','female')", name="ck_patient_gender"),
        Index("uq_patients_email", func.lower(text("email")), unique=True),
        Index("idx_patients_phone", "phone"),
    )
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    customer_number: Mapped[str] = mapped_column(String(6), unique=True)
    supabase_user_id: Mapped[UUID | None] = mapped_column(unique=True)
    full_name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(254))
    email_verified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    phone: Mapped[str] = mapped_column(String(16))
    date_of_birth: Mapped[date] = mapped_column(Date)
    preferred_language: Mapped[str] = mapped_column(
        ENUM("ar", "en", name="preferred_language"), server_default="ar"
    )
    gender: Mapped[str | None] = mapped_column(String(16))
    insurance_provider: Mapped[str | None] = mapped_column(String(128))
    insurance_policy_number: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Challenge(Base):
    __tablename__ = "verification_challenges"
    __table_args__ = (
        CheckConstraint(
            "failed_attempts BETWEEN 0 AND 3", name="ck_challenge_attempts"
        ),
        CheckConstraint(
            "(purpose='login' AND pending_registration IS NULL) OR "
            "(purpose='registration' AND patient_id IS NULL)",
            name="ck_challenge_purpose",
        ),
        CheckConstraint(
            "(status='verified') = (verified_at IS NOT NULL)",
            name="ck_challenge_verified",
        ),
        Index(
            "uq_challenge_pending",
            "conversation_session_id",
            "purpose",
            unique=True,
            postgresql_where=text("status='pending'"),
        ),
        Index("idx_challenges_patient_time", "patient_id", "created_at"),
    )
    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=func.gen_random_uuid()
    )
    purpose: Mapped[str] = mapped_column(
        ENUM("login", "registration", name="verification_purpose")
    )
    conversation_session_id: Mapped[UUID] = mapped_column(
        ForeignKey("conversation_sessions.id", ondelete="CASCADE")
    )
    patient_id: Mapped[int | None] = mapped_column(
        ForeignKey("patients.id", ondelete="CASCADE")
    )
    pending_registration: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB(none_as_null=True)
    )
    code_hash: Mapped[bytes | None] = mapped_column(LargeBinary)
    status: Mapped[str] = mapped_column(
        ENUM(
            "pending",
            "verified",
            "failed",
            "expired",
            "superseded",
            name="challenge_status",
        ),
        server_default="pending",
    )
    failed_attempts: Mapped[int] = mapped_column(SmallInteger, server_default="0")
    client_ip: Mapped[str | None] = mapped_column(INET)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class PatientSession(Base):
    __tablename__ = "patient_sessions"
    __table_args__ = (
        CheckConstraint(
            "revoke_reason IN "
            "('call_ended','resume_expired','logout','account_switch','staff')",
            name="ck_session_revoke_reason",
        ),
        Index(
            "uq_patient_session_live",
            "conversation_session_id",
            unique=True,
            postgresql_where=text("revoked_at IS NULL"),
        ),
        Index("idx_patient_sessions_patient", "patient_id"),
    )
    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=func.gen_random_uuid()
    )
    patient_id: Mapped[int] = mapped_column(
        ForeignKey("patients.id", ondelete="CASCADE")
    )
    supabase_session_id: Mapped[UUID | None]
    conversation_session_id: Mapped[UUID] = mapped_column(
        ForeignKey("conversation_sessions.id", ondelete="CASCADE")
    )
    verified_via: Mapped[UUID | None] = mapped_column(
        ForeignKey("verification_challenges.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    last_activity_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoke_reason: Mapped[str | None] = mapped_column(String(32))
