import hashlib
import json
import re
from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Annotated, Any

from clinic_schemas import bookings as dto
from clinic_schemas.catalog import MAX_CATALOG_ID
from fastapi import APIRouter, Depends, Path, Query, Request
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from starlette.responses import JSONResponse, Response

from clinic_backend.bookings import Bookings
from clinic_backend.conversations import require_service
from clinic_backend.errors import APIError, ErrorEnvelope, error_response
from clinic_backend.idempotency import IdempotencyKey
from clinic_backend.identity import Identity
from clinic_backend.settings import Settings


def booking_router(
    sessions: async_sessionmaker[AsyncSession],
    settings: Settings,
    clock: Callable[[], datetime],
) -> APIRouter:
    router = APIRouter(
        prefix="/api/v1/patients/me/appointments", tags=["Patient appointments"]
    )
    errors: dict[int | str, dict[str, Any]] = {
        code: {"model": ErrorEnvelope} for code in [400, 401, 404, 409, 422, 429, 503]
    }

    async def service(request: Request) -> None:
        require_service(request, settings)
        keys = [key for key, _ in request.query_params.multi_items()]
        if len(keys) != len(set(keys)):
            raise APIError(400, "VALIDATION_FAILED", "Duplicate query parameters.")

    async def authorize(
        session: AsyncSession, request: Request, now: datetime
    ) -> Bookings | APIError:
        identity = Identity(session, settings)
        conversation = await identity.conversation(
            request.headers.get("X-Conversation-Token", "")
        )
        if isinstance(conversation, APIError):
            return conversation
        binding, expired = await identity.live_session(conversation, refresh=True)
        if binding is None:
            return APIError(
                401,
                "SESSION_EXPIRED" if expired else "VERIFICATION_REQUIRED",
                "Patient verification required.",
            )
        return Bookings(
            session, settings, binding.patient_id, conversation.id, now, clock
        )

    async def read(
        request: Request, query: dto.AppointmentQuery | None, ident: int | None
    ) -> Response:
        async with sessions() as session, session.begin():
            store = await authorize(session, request, clock())
            if isinstance(store, APIError):
                response = error_response(
                    request, store.status, store.code, store.message, store.details
                )
            elif ident is None:
                assert query is not None
                response = JSONResponse(await store.list(query))
            else:
                if request.query_params:
                    raise APIError(
                        400, "VALIDATION_FAILED", "Unexpected query parameters."
                    )
                response = JSONResponse(
                    await store.representation(await store.owned(ident), detail=True)
                )
        response.headers["Cache-Control"] = "no-store"
        return response

    async def write(
        request: Request,
        operation: str,
        body: dto.Book | dto.Slot | dto.Cancel,
        ident: int | None,
    ) -> Response:
        if request.query_params:
            raise APIError(400, "VALIDATION_FAILED", "Unexpected query parameters.")
        key = request.headers.get("Idempotency-Key", "")
        if not key:
            raise APIError(
                400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key is required."
            )
        if not re.fullmatch(r"[\x21-\x7e]{1,128}", key):
            raise APIError(400, "VALIDATION_FAILED", "Invalid idempotency key.")
        now = clock()
        fingerprint = hashlib.sha256(
            json.dumps(
                {
                    "operation": operation,
                    "target": ident,
                    "body": body.model_dump(mode="json"),
                },
                sort_keys=True,
                separators=(",", ":"),
            ).encode()
        ).digest()
        async with sessions() as session, session.begin():
            store = await authorize(session, request, now)
            if isinstance(store, APIError):
                response = error_response(
                    request, store.status, store.code, store.message, store.details
                )
            else:
                scope = f":idempotency:{store.patient_id}:{operation}:{key}"
                acquired = await session.scalar(
                    text(
                        "SELECT pg_try_advisory_xact_lock("
                        "hashtextextended(current_schema() || :scope,0))"
                    ),
                    {"scope": scope},
                )
                if not acquired:
                    raise APIError(
                        409, "IDEMPOTENCY_IN_PROGRESS", "Operation is still running."
                    )
                existing = await session.get(
                    IdempotencyKey, (store.patient_id, operation, key)
                )
                if existing is not None and existing.expires_at <= now:
                    await session.delete(existing)
                    await session.flush()
                    existing = None
                if existing is not None:
                    if existing.request_hash != fingerprint:
                        raise APIError(
                            422,
                            "IDEMPOTENCY_KEY_REUSED",
                            "Key belongs to a different request.",
                        )
                    if existing.response_status is None:
                        raise APIError(
                            409,
                            "IDEMPOTENCY_IN_PROGRESS",
                            "Operation is still running.",
                        )
                    response = JSONResponse(
                        existing.response_body, status_code=existing.response_status
                    )
                else:
                    record = IdempotencyKey(
                        patient_id=store.patient_id,
                        operation=operation,
                        idempotency_key=key,
                        request_hash=fingerprint,
                        created_at=now,
                        expires_at=now + timedelta(hours=24),
                    )
                    session.add(record)
                    await session.flush()
                    try:
                        async with session.begin_nested():
                            status, result = await store.mutate(operation, body, ident)
                        response = JSONResponse(result, status_code=status)
                    except IntegrityError as exc:
                        if not any(
                            name in str(exc.orig)
                            for name in (
                                "uq_doctor_slot_active",
                                "uq_patient_slot_active",
                            )
                        ):
                            raise
                        response = error_response(
                            request,
                            409,
                            "SLOT_UNAVAILABLE",
                            "Slot is no longer available.",
                        )
                    except APIError as exc:
                        response = error_response(
                            request, exc.status, exc.code, exc.message, exc.details
                        )
                    record.response_status = response.status_code
                    record.response_body = json.loads(bytes(response.body))
        response.headers["Cache-Control"] = "no-store"
        return response

    @router.get(
        "",
        response_model=dto.AppointmentList,
        responses=errors,
        dependencies=[Depends(service)],
    )
    async def listing(
        request: Request, query: Annotated[dto.AppointmentQuery, Query()]
    ) -> Response:
        return await read(request, query, None)

    @router.get(
        "/{appointment_id}",
        response_model=dto.Appointment,
        responses=errors,
        dependencies=[Depends(service)],
    )
    async def detail(
        request: Request, appointment_id: Annotated[int, Path(gt=0, le=MAX_CATALOG_ID)]
    ) -> Response:
        return await read(request, None, appointment_id)

    @router.post(
        "",
        status_code=201,
        response_model=dto.Appointment,
        responses=errors,
        dependencies=[Depends(service)],
    )
    async def book(request: Request, body: dto.Book) -> Response:
        return await write(request, "book_appointment", body, None)

    @router.post(
        "/{appointment_id}/reschedule",
        response_model=dto.Rescheduled,
        responses=errors,
        dependencies=[Depends(service)],
    )
    async def reschedule(
        request: Request,
        appointment_id: Annotated[int, Path(gt=0, le=MAX_CATALOG_ID)],
        body: dto.Slot,
    ) -> Response:
        return await write(request, "reschedule_appointment", body, appointment_id)

    @router.post(
        "/{appointment_id}/cancel",
        response_model=dto.Cancelled,
        responses=errors,
        dependencies=[Depends(service)],
    )
    async def cancel(
        request: Request,
        appointment_id: Annotated[int, Path(gt=0, le=MAX_CATALOG_ID)],
        body: dto.Cancel,
    ) -> Response:
        return await write(request, "cancel_appointment", body, appointment_id)

    return router
