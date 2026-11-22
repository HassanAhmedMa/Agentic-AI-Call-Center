from datetime import date, datetime, time
from uuid import UUID

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import Mapped, mapped_column

from clinic_backend.models import Base, Timestamps

actor_type = ENUM("patient", "clinic_staff", "system", name="actor_type")


class ClinicClosure(Timestamps, Base):
    __tablename__ = "clinic_closures"
    closure_date: Mapped[date] = mapped_column(primary_key=True)
    reason_en: Mapped[str] = mapped_column(String(255))
    reason_ar: Mapped[str] = mapped_column(String(255))


class DoctorTimeOff(Timestamps, Base):
    __tablename__ = "doctor_time_off"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    doctor_id: Mapped[int] = mapped_column(ForeignKey("doctors.id", ondelete="CASCADE"))
    off_date: Mapped[date]
    start_time: Mapped[time | None]
    end_time: Mapped[time | None]
    reason: Mapped[str | None] = mapped_column(String(255))
    __table_args__ = (Index("idx_time_off_doctor_date", "doctor_id", "off_date"),)


class Appointment(Timestamps, Base):
    __tablename__ = "appointments"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    patient_id: Mapped[int] = mapped_column(
        ForeignKey("patients.id", ondelete="RESTRICT")
    )
    doctor_id: Mapped[int] = mapped_column(
        ForeignKey("doctors.id", ondelete="RESTRICT")
    )
    appointment_date: Mapped[date]
    start_time: Mapped[time]
    end_time: Mapped[time]
    status: Mapped[str] = mapped_column(
        ENUM(
            "scheduled", "completed", "cancelled", "no_show", name="appointment_status"
        ),
        server_default="scheduled",
    )
    visit_reason: Mapped[str | None] = mapped_column(String(300))
    cancellation_reason: Mapped[str | None] = mapped_column(String(300))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_by: Mapped[str | None] = mapped_column(actor_type)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class AppointmentHistory(Timestamps, Base):
    __tablename__ = "appointment_history"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    appointment_id: Mapped[int] = mapped_column(
        ForeignKey("appointments.id", ondelete="CASCADE")
    )
    event: Mapped[str] = mapped_column(
        ENUM(
            "created",
            "time_changed",
            "cancelled",
            "completed",
            "marked_no_show",
            name="appointment_event",
        )
    )
    previous_date: Mapped[date | None]
    previous_start_time: Mapped[time | None]
    new_date: Mapped[date | None]
    new_start_time: Mapped[time | None]
    actor: Mapped[str] = mapped_column(actor_type)
    conversation_session_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("conversation_sessions.id", ondelete="SET NULL")
    )
