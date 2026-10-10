from datetime import datetime, time
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    Time,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Timestamps:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Specialty(Timestamps, Base):
    __tablename__ = "specialties"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name_en: Mapped[str] = mapped_column(String(128), unique=True)
    name_ar: Mapped[str] = mapped_column(String(128), unique=True)
    synonyms: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default="{}")
    search_terms: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default="{}")
    __table_args__ = (
        Index("idx_specialties_search_terms", "search_terms", postgresql_using="gin"),
    )


class Doctor(Timestamps, Base):
    __tablename__ = "doctors"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name_en: Mapped[str] = mapped_column(String(255))
    name_ar: Mapped[str] = mapped_column(String(255))
    title_en: Mapped[str] = mapped_column(String(128))
    title_ar: Mapped[str] = mapped_column(String(128))
    specialty_id: Mapped[int] = mapped_column(
        ForeignKey("specialties.id", ondelete="RESTRICT")
    )
    bio_en: Mapped[str] = mapped_column(Text)
    bio_ar: Mapped[str | None] = mapped_column(Text)
    languages: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default="{ar,en}")
    consultation_fee: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    working_days: Mapped[list[int]] = mapped_column(ARRAY(SmallInteger))
    shift_start: Mapped[time] = mapped_column(Time)
    shift_end: Mapped[time] = mapped_column(Time)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    __table_args__ = (
        CheckConstraint("consultation_fee >= 0", name="ck_doctors_fee"),
        CheckConstraint(
            "cardinality(working_days) > 0 "
            "AND working_days <@ ARRAY[1,2,3,4,6,7]::smallint[] "
            "AND array_position(working_days, NULL) IS NULL",
            name="ck_doctors_days",
        ),
        CheckConstraint(
            "shift_start >= TIME '07:00' AND shift_end <= TIME '22:00' "
            "AND shift_end > shift_start",
            name="ck_doctors_shift_bounds",
        ),
        CheckConstraint(
            "EXTRACT(MINUTE FROM shift_start) IN (0,30) "
            "AND EXTRACT(SECOND FROM shift_start)=0 "
            "AND EXTRACT(MINUTE FROM shift_end) IN (0,30) "
            "AND EXTRACT(SECOND FROM shift_end)=0",
            name="ck_doctors_shift_grid",
        ),
        Index("idx_doctors_specialty", "specialty_id"),
        Index("idx_doctors_active", "is_active"),
    )


class Service(Timestamps, Base):
    __tablename__ = "services"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name_en: Mapped[str] = mapped_column(String(255), unique=True)
    name_ar: Mapped[str] = mapped_column(String(255), unique=True)
    category: Mapped[str] = mapped_column(String(64))
    description_en: Mapped[str] = mapped_column(Text)
    description_ar: Mapped[str | None] = mapped_column(Text)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    duration_minutes: Mapped[int] = mapped_column(Integer, server_default="30")
    preparation_instructions_en: Mapped[str | None] = mapped_column(Text)
    preparation_instructions_ar: Mapped[str | None] = mapped_column(Text)
    is_available: Mapped[bool] = mapped_column(Boolean, server_default="true")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    __table_args__ = (
        CheckConstraint("price >= 0", name="ck_services_price"),
        CheckConstraint("duration_minutes > 0", name="ck_services_duration"),
    )
