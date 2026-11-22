from collections.abc import Callable
from datetime import datetime, time, timedelta
from uuid import UUID

from clinic_schemas import bookings as dto
from sqlalchemy import func, select, true
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from clinic_backend.errors import APIError
from clinic_backend.identity_models import Patient
from clinic_backend.models import Doctor, Specialty
from clinic_backend.scheduling_models import (
    Appointment,
    AppointmentHistory,
    ClinicClosure,
    DoctorTimeOff,
)
from clinic_backend.settings import Settings
from clinic_backend.slot_rules import slot_instant


class Bookings:
    def __init__(
        self,
        session: AsyncSession,
        settings: Settings,
        patient_id: int,
        conversation_id: UUID,
        now: datetime,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self.session, self.settings, self.patient_id, self.conversation_id, self.now = (
            session,
            settings,
            patient_id,
            conversation_id,
            now,
        )
        self.clock = clock or (lambda: now)

    async def lock_patient(self) -> None:
        await self.session.scalar(
            select(Patient).where(Patient.id == self.patient_id).with_for_update()
        )
        self.now = self.clock()

    def future(self) -> ColumnElement[bool]:
        return (
            func.timezone(
                "Africa/Cairo", Appointment.appointment_date + Appointment.start_time
            )
            > self.now
        )

    async def owned(self, ident: int, *, lock: bool = False) -> Appointment:
        query = select(Appointment).where(
            Appointment.id == ident, Appointment.patient_id == self.patient_id
        )
        item = await self.session.scalar(query.with_for_update() if lock else query)
        if item is None:
            raise APIError(404, "APPOINTMENT_NOT_FOUND", "Appointment not found.")
        return item

    def changeable(self, item: Appointment) -> bool:
        return item.status == "scheduled" and slot_instant(
            item.appointment_date, item.start_time
        ) - self.now >= timedelta(hours=4)

    async def representation(
        self, item: Appointment, *, detail: bool = False
    ) -> dict[str, object]:
        doctor, specialty = (
            await self.session.execute(
                select(Doctor, Specialty)
                .join(Specialty, Specialty.id == Doctor.specialty_id)
                .where(Doctor.id == item.doctor_id)
            )
        ).one()
        result: dict[str, object] = {
            "id": item.id,
            "doctor": {
                "id": doctor.id,
                "name_en": doctor.name_en,
                "name_ar": doctor.name_ar,
                "specialty": {
                    "id": specialty.id,
                    "name_en": specialty.name_en,
                    "name_ar": specialty.name_ar,
                },
            },
            "date": item.appointment_date.isoformat(),
            "start_time": item.start_time.strftime("%H:%M"),
            "end_time": item.end_time.strftime("%H:%M"),
            "status": item.status,
            "visit_reason": item.visit_reason,
            "can_change": self.changeable(item),
        }
        if detail:
            result.update(
                created_at=item.created_at.isoformat(),
                updated_at=item.updated_at.isoformat(),
            )
            if item.status == "cancelled":
                result.update(
                    cancelled_at=(
                        item.cancelled_at.isoformat() if item.cancelled_at else None
                    ),
                    cancellation_reason=item.cancellation_reason,
                )
        return dto.Appointment.model_validate(result).model_dump(
            mode="json", exclude_unset=True
        )

    async def list(self, query: dto.AppointmentQuery) -> dict[str, object]:
        filters = [Appointment.patient_id == self.patient_id]
        if query.status != "all":
            filters.append(Appointment.status == query.status)
        if query.upcoming_only is True or (
            query.upcoming_only is None and query.status == "scheduled"
        ):
            filters.append(self.future())
        total = await self.session.scalar(
            select(func.count()).select_from(Appointment).where(*filters)
        )
        items = (
            await self.session.scalars(
                select(Appointment)
                .where(*filters)
                .order_by(
                    Appointment.appointment_date, Appointment.start_time, Appointment.id
                )
                .limit(query.limit)
                .offset(query.offset)
            )
        ).all()
        return {
            "total": total or 0,
            "appointments": [await self.representation(item) for item in items],
        }

    async def validate_slot(
        self, doctor_id: int, body: dto.Slot, exclude: int | None = None
    ) -> tuple[time, time]:
        start = time.fromisoformat(body.start_time)
        if start.minute not in (0, 30) or not time(7) <= start <= time(21, 30):
            raise APIError(
                422, "INVALID_SLOT_TIME", "Choose an aligned 30-minute slot."
            )
        end = (datetime.combine(body.date, start) + timedelta(minutes=30)).time()
        doctor = await self.session.scalar(
            select(Doctor)
            .where(Doctor.id == doctor_id, Doctor.is_active.is_(True))
            .with_for_update()
        )
        if doctor is None:
            raise APIError(404, "DOCTOR_NOT_FOUND", "Doctor not found.")
        self.now = self.clock()
        closure = await self.session.get(ClinicClosure, body.date)
        if body.date.isoweekday() == 5 or closure:
            raise APIError(422, "CLINIC_CLOSED", "Clinic is closed.")
        off = (
            await self.session.scalars(
                select(DoctorTimeOff).where(
                    DoctorTimeOff.doctor_id == doctor_id,
                    DoctorTimeOff.off_date == body.date,
                )
            )
        ).all()
        if (
            body.date.isoweekday() not in doctor.working_days
            or start < doctor.shift_start
            or end > doctor.shift_end
            or any(
                item.start_time is None
                or (
                    item.end_time is not None
                    and start < item.end_time
                    and end > item.start_time
                )
                for item in off
            )
        ):
            raise APIError(422, "DOCTOR_UNAVAILABLE", "Doctor is unavailable.")
        try:
            instant = slot_instant(body.date, start)
        except ValueError:
            raise APIError(422, "INVALID_SLOT_TIME", "Invalid local time.") from None
        if instant < self.now + timedelta(
            minutes=self.settings.booking_min_lead_minutes
        ):
            raise APIError(422, "BOOKING_TOO_SOON", "Choose a later slot.")
        if instant > self.now + timedelta(days=self.settings.booking_horizon_days):
            raise APIError(422, "BOOKING_TOO_FAR_AHEAD", "Choose a nearer slot.")
        active = list(
            (
                await self.session.scalars(
                    select(Appointment).where(
                        Appointment.patient_id == self.patient_id,
                        Appointment.status == "scheduled",
                        self.future(),
                        Appointment.id != exclude if exclude is not None else true(),
                    )
                )
            ).all()
        )
        daily = [item for item in active if item.appointment_date == body.date]
        if any(item.doctor_id == doctor_id for item in daily):
            raise APIError(
                409,
                "DUPLICATE_DOCTOR_SAME_DAY",
                "Already booked with this doctor that day.",
            )
        if len(daily) >= 2:
            raise APIError(
                409, "DAILY_LIMIT_REACHED", "Daily appointment limit reached."
            )
        if len(active) >= 5:
            raise APIError(
                409, "ACTIVE_LIMIT_REACHED", "Active appointment limit reached."
            )
        conflict = await self.session.scalar(
            select(Appointment.id)
            .where(
                Appointment.status == "scheduled",
                Appointment.appointment_date == body.date,
                Appointment.start_time == start,
                Appointment.id != exclude if exclude is not None else true(),
                (Appointment.doctor_id == doctor_id)
                | (Appointment.patient_id == self.patient_id),
            )
            .limit(1)
        )
        if conflict:
            raise APIError(409, "SLOT_UNAVAILABLE", "Slot is no longer available.")
        self.now = self.clock()
        if instant < self.now + timedelta(
            minutes=self.settings.booking_min_lead_minutes
        ):
            raise APIError(422, "BOOKING_TOO_SOON", "Choose a later slot.")
        if instant > self.now + timedelta(days=self.settings.booking_horizon_days):
            raise APIError(422, "BOOKING_TOO_FAR_AHEAD", "Choose a nearer slot.")
        return start, end

    async def mutate(
        self, operation: str, body: dto.Book | dto.Slot | dto.Cancel, ident: int | None
    ) -> tuple[int, dict[str, object]]:
        await self.lock_patient()
        previous = None
        if operation == "book_appointment":
            assert isinstance(body, dto.Book)
            start, end = await self.validate_slot(body.doctor_id, body)
            item = Appointment(
                patient_id=self.patient_id,
                doctor_id=body.doctor_id,
                appointment_date=body.date,
                start_time=start,
                end_time=end,
                status="scheduled",
                visit_reason=body.visit_reason,
                updated_at=self.now,
            )
            self.session.add(item)
            await self.session.flush()
            event = "created"
        else:
            assert ident is not None
            item = await self.owned(ident, lock=True)
            self.now = self.clock()
            if item.status != "scheduled":
                raise APIError(
                    409, "APPOINTMENT_NOT_ACTIVE", "Appointment is not active."
                )
            if not self.changeable(item):
                raise APIError(
                    422, "CHANGE_WINDOW_CLOSED", "Changes require four hours notice."
                )
            if operation == "reschedule_appointment":
                assert isinstance(body, dto.Slot)
                if (
                    body.date == item.appointment_date
                    and body.start_time == item.start_time.strftime("%H:%M")
                ):
                    raise APIError(422, "SAME_SLOT", "Choose a different slot.")
                start, end = await self.validate_slot(item.doctor_id, body, item.id)
                if not self.changeable(item):
                    raise APIError(
                        422,
                        "CHANGE_WINDOW_CLOSED",
                        "Changes require four hours notice.",
                    )
                previous = {
                    "date": item.appointment_date.isoformat(),
                    "start_time": item.start_time.strftime("%H:%M"),
                }
                self.session.add(
                    AppointmentHistory(
                        appointment_id=item.id,
                        event="time_changed",
                        previous_date=item.appointment_date,
                        previous_start_time=item.start_time,
                        new_date=body.date,
                        new_start_time=start,
                        actor="patient",
                        conversation_session_id=self.conversation_id,
                    )
                )
                item.appointment_date, item.start_time, item.end_time = (
                    body.date,
                    start,
                    end,
                )
                event = None
            else:
                assert isinstance(body, dto.Cancel)
                item.status, item.cancelled_at, item.cancelled_by = (
                    "cancelled",
                    self.now,
                    "patient",
                )
                item.cancellation_reason = body.reason
                event = "cancelled"
            item.updated_at = self.now
        if event:
            self.session.add(
                AppointmentHistory(
                    appointment_id=item.id,
                    event=event,
                    actor="patient",
                    conversation_session_id=self.conversation_id,
                )
            )
        await self.session.flush()
        if operation == "cancel_appointment":
            return 200, {
                "id": item.id,
                "status": "cancelled",
                "cancelled_at": self.now.isoformat(),
            }
        result = await self.representation(item, detail=True)
        if previous:
            result["previous"] = previous
        return (201 if operation == "book_appointment" else 200), result
