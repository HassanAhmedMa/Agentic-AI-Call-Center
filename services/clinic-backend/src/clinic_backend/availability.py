from collections.abc import Callable
from datetime import date, datetime, time, timedelta

from clinic_schemas import availability as dto
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from clinic_backend.errors import APIError
from clinic_backend.models import Doctor
from clinic_backend.scheduling_models import Appointment, ClinicClosure, DoctorTimeOff
from clinic_backend.settings import Settings
from clinic_backend.slot_rules import Schedule, TimeOff, generate_day, slot_instant


class Availability:
    def __init__(
        self, session: AsyncSession, settings: Settings, clock: Callable[[], datetime]
    ):
        self.session = session
        self.settings = settings
        self.clock = clock

    async def days(
        self, doctors: list[Doctor], query: dto.AvailabilityQuery, now: datetime
    ) -> dict[int, list[dto.SlotDay]]:
        end = query.to_date or query.from_date
        ids = [doctor.id for doctor in doctors]
        if not ids:
            return {}
        closures = set(
            (
                await self.session.scalars(
                    select(ClinicClosure.closure_date).where(
                        ClinicClosure.closure_date.between(query.from_date, end)
                    )
                )
            ).all()
        )
        off = (
            await self.session.scalars(
                select(DoctorTimeOff).where(
                    DoctorTimeOff.doctor_id.in_(ids),
                    DoctorTimeOff.off_date.between(query.from_date, end),
                )
            )
        ).all()
        booked = (
            await self.session.execute(
                select(
                    Appointment.doctor_id,
                    Appointment.appointment_date,
                    Appointment.start_time,
                ).where(
                    Appointment.doctor_id.in_(ids),
                    Appointment.appointment_date.between(query.from_date, end),
                    Appointment.status == "scheduled",
                )
            )
        ).all()
        off_by_day: dict[tuple[int, date], list[TimeOff]] = {}
        occupied: dict[tuple[int, date], set[time]] = {}
        for item in off:
            off_by_day.setdefault((item.doctor_id, item.off_date), []).append(
                TimeOff(item.start_time, item.end_time)
            )
        for doctor_id, appointment_date, start in booked:
            occupied.setdefault((doctor_id, appointment_date), set()).add(start)
        results = {}
        for doctor in doctors:
            schedule = Schedule(
                tuple(doctor.working_days), doctor.shift_start, doctor.shift_end
            )
            days = []
            for offset in range((end - query.from_date).days + 1):
                day = query.from_date + timedelta(days=offset)
                key = (doctor.id, day)
                days.append(
                    generate_day(
                        schedule,
                        day,
                        now,
                        lead_minutes=self.settings.booking_min_lead_minutes,
                        horizon_days=self.settings.booking_horizon_days,
                        closure=day in closures,
                        time_off=off_by_day.get(key, []),
                        occupied=occupied.get(key, set()),
                    )
                )
            results[doctor.id] = days
        return results

    async def doctor(
        self, doctor_id: int, query: dto.AvailabilityQuery
    ) -> dto.DoctorAvailability:
        doctor = await self.session.scalar(
            select(Doctor).where(Doctor.id == doctor_id, Doctor.is_active.is_(True))
        )
        if doctor is None:
            raise APIError(404, "DOCTOR_NOT_FOUND", "Doctor not found.")
        days = await self.days([doctor], query, self.clock())
        return dto.DoctorAvailability(doctor_id=doctor_id, days=days[doctor_id])

    async def search(self, query: dto.SearchQuery) -> dto.AvailabilitySearch:
        statement = select(Doctor).where(Doctor.is_active.is_(True))
        if query.doctor_id is not None:
            statement = statement.where(Doctor.id == query.doctor_id)
        if query.specialty_id is not None:
            statement = statement.where(Doctor.specialty_id == query.specialty_id)
        doctors = list((await self.session.scalars(statement)).all())
        days = await self.days(doctors, query, self.clock())
        results = []
        for doctor in doctors:
            for day in days[doctor.id]:
                for start in day.slots:
                    clock = time.fromisoformat(start)
                    if query.earliest_time is not None and clock < query.earliest_time:
                        continue
                    if query.latest_time is not None and clock >= query.latest_time:
                        continue
                    results.append(
                        dto.SearchResult(
                            doctor=dto.DoctorName(
                                id=doctor.id,
                                name_en=doctor.name_en,
                                name_ar=doctor.name_ar,
                            ),
                            date=day.date,
                            start_time=start,
                        )
                    )
        results.sort(
            key=lambda item: (
                slot_instant(item.date, time.fromisoformat(item.start_time)),
                item.doctor.id,
            )
        )
        return dto.AvailabilitySearch(results=results[: query.limit])
