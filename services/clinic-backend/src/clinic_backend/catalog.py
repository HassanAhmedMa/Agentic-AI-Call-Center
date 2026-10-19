from clinic_schemas import catalog as dto
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from clinic_backend import models
from clinic_backend.search import normalize_search, normalized_sql

_DAYS = ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")


def specialty_dto(item: models.Specialty) -> dto.Specialty:
    return dto.Specialty(id=item.id, name_en=item.name_en, name_ar=item.name_ar)


def doctor_dto(item: models.Doctor, specialty: models.Specialty) -> dto.Doctor:
    s_start = item.shift_start.strftime("%H:%M") if item.shift_start else "09:00"
    s_end = item.shift_end.strftime("%H:%M") if item.shift_end else "17:00"
    days_list = (
        [_DAYS[d - 1] for d in item.working_days]
        if item.working_days
        else ["saturday", "sunday", "monday", "tuesday", "wednesday", "thursday"]
    )
    return dto.Doctor(
        id=item.id,
        name_en=item.name_en,
        name_ar=item.name_ar,
        title_en=item.title_en,
        title_ar=item.title_ar,
        specialty=specialty_dto(specialty),
        languages=item.languages,
        consultation_fee=dto.Money(amount=float(item.consultation_fee)),
        shift_start=s_start,
        shift_end=s_end,
        working_days=days_list,
        working_hours=dto.WorkingHours(start=s_start, end=s_end),
    )


def service_dto(item: models.Service) -> dto.Service:
    return dto.Service(
        id=item.id,
        name_en=item.name_en,
        name_ar=item.name_ar,
        category=item.category,
        price=dto.Money(amount=float(item.price)),
        duration_minutes=item.duration_minutes,
    )


class Catalog:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def specialties(self) -> dto.SpecialtyList:
        rows = (
            await self.session.scalars(
                select(models.Specialty).order_by(models.Specialty.id)
            )
        ).all()
        return dto.SpecialtyList(
            total=len(rows), specialties=[specialty_dto(s) for s in rows]
        )

    async def doctors(self, query: dto.DoctorQuery) -> dto.DoctorList:
        statement = (
            select(models.Doctor, models.Specialty)
            .join(models.Specialty)
            .where(models.Doctor.is_active.is_(True))
        )
        if query.specialty_id is not None:
            statement = statement.where(
                models.Doctor.specialty_id == query.specialty_id
            )
        term = normalize_search(query.q or "")
        if term:
            statement = statement.where(
                or_(
                    normalized_sql(models.Doctor.name_en).contains(
                        term, autoescape=True
                    ),
                    normalized_sql(models.Doctor.name_ar).contains(
                        term, autoescape=True
                    ),
                    func.array_to_string(models.Specialty.search_terms, "\n").contains(
                        term, autoescape=True
                    ),
                )
            )
        total = await self.session.scalar(
            select(func.count()).select_from(statement.subquery())
        )
        rows = (
            await self.session.execute(
                statement.order_by(models.Doctor.id)
                .limit(query.limit)
                .offset(query.offset)
            )
        ).all()
        return dto.DoctorList(
            total=total or 0, doctors=[doctor_dto(d, s) for d, s in rows]
        )

    async def doctor(self, doctor_id: int) -> dto.DoctorDetail | None:
        row = (
            await self.session.execute(
                select(models.Doctor, models.Specialty)
                .join(models.Specialty)
                .where(models.Doctor.id == doctor_id, models.Doctor.is_active.is_(True))
            )
        ).first()
        if row is None:
            return None
        doctor, specialty = row
        return dto.DoctorDetail(
            **doctor_dto(doctor, specialty).model_dump(),
            bio_en=doctor.bio_en,
            bio_ar=doctor.bio_ar,
            working_days=[_DAYS[d - 1] for d in doctor.working_days],
            working_hours=dto.WorkingHours(
                start=doctor.shift_start.strftime("%H:%M"),
                end=doctor.shift_end.strftime("%H:%M"),
            ),
        )

    async def services(self, query: dto.ServiceQuery) -> dto.ServiceList:
        statement = select(models.Service).where(models.Service.is_available.is_(True))
        if query.category is not None:
            statement = statement.where(models.Service.category == query.category)
        total = await self.session.scalar(
            select(func.count()).select_from(statement.subquery())
        )
        rows = (
            await self.session.scalars(
                statement.order_by(models.Service.id)
                .limit(query.limit)
                .offset(query.offset)
            )
        ).all()
        return dto.ServiceList(
            total=total or 0, services=[service_dto(s) for s in rows]
        )

    async def service(self, service_id: int) -> dto.ServiceDetail | None:
        item = await self.session.scalar(
            select(models.Service).where(
                models.Service.id == service_id, models.Service.is_available.is_(True)
            )
        )
        if item is None:
            return None
        return dto.ServiceDetail(
            **service_dto(item).model_dump(),
            description_en=item.description_en,
            description_ar=item.description_ar,
            preparation_instructions_en=item.preparation_instructions_en,
            preparation_instructions_ar=item.preparation_instructions_ar,
        )
