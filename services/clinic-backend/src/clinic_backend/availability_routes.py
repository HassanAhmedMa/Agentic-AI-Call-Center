from collections.abc import AsyncIterator, Callable
from datetime import datetime
from typing import Annotated, Any

from clinic_schemas import availability as dto
from clinic_schemas.catalog import MAX_CATALOG_ID
from fastapi import APIRouter, Depends, Path, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from clinic_backend.availability import Availability
from clinic_backend.errors import APIError, ErrorEnvelope
from clinic_backend.settings import Settings


def availability_router(
    sessions: async_sessionmaker[AsyncSession],
    settings: Settings,
    clock: Callable[[], datetime],
) -> APIRouter:
    router = APIRouter()

    async def store() -> AsyncIterator[Availability]:
        async with sessions() as session:
            yield Availability(session, settings, clock)

    async def no_duplicates(request: Request) -> None:
        keys = [key for key, _ in request.query_params.multi_items()]
        if len(keys) != len(set(keys)):
            raise APIError(400, "VALIDATION_FAILED", "Duplicate query parameters.")

    errors: dict[int | str, dict[str, Any]] = {
        400: {"model": ErrorEnvelope},
        404: {"model": ErrorEnvelope},
        429: {"model": ErrorEnvelope},
        503: {"model": ErrorEnvelope},
    }

    @router.get(
        "/api/v1/doctors/{doctor_id}/availability",
        response_model=dto.DoctorAvailability,
        response_model_exclude_none=True,
        responses=errors,
        dependencies=[Depends(no_duplicates)],
    )
    async def doctor(
        doctor_id: Annotated[int, Path(gt=0, le=MAX_CATALOG_ID)],
        query: Annotated[dto.AvailabilityQuery, Query()],
        availability: Annotated[Availability, Depends(store)],
    ) -> dto.DoctorAvailability:
        return await availability.doctor(doctor_id, query)

    @router.get(
        "/api/v1/availability/search",
        response_model=dto.AvailabilitySearch,
        responses=errors,
        dependencies=[Depends(no_duplicates)],
    )
    async def search(
        query: Annotated[dto.SearchQuery, Query()],
        availability: Annotated[Availability, Depends(store)],
    ) -> dto.AvailabilitySearch:
        return await availability.search(query)

    return router
