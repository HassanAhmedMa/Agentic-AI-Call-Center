import asyncio
import logging
import math
import re
import time
from collections import deque
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager, suppress
from pathlib import Path as FilePath
from typing import Annotated, Any, Literal
from uuid import uuid4

from clinic_schemas import catalog as dto
from fastapi import (
    Depends,
    FastAPI,
    Path,
    Query,
    Request,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker
from starlette.exceptions import HTTPException
from starlette.responses import FileResponse, Response
from starlette.staticfiles import StaticFiles

from clinic_backend.catalog import Catalog
from clinic_backend.conversations import conversation_router
from clinic_backend.database import is_ready, make_engine
from clinic_backend.errors import APIError, ErrorEnvelope, error_response
from clinic_backend.identity_models import Patient
from clinic_backend.mail import Delivery, SMTPDelivery
from clinic_backend.settings import Settings
from clinic_backend.websocket_manager import ws_manager

logger = logging.getLogger("clinic_backend")


class Health(BaseModel):
    status: Literal["ok", "ready"]


class PublicLimiter:
    """Bounded per-IP sliding window for one-process local development only.

    Deployments must replace this with shared atomic limits before scaling.
    Forwarded headers are deliberately ignored; use the actual peer address.
    """

    def __init__(self, limit: int) -> None:
        self.limit = limit
        self.buckets: dict[str, deque[float]] = {}

    def retry_after(self, peer: str) -> int:
        now = time.monotonic()
        # Expire inactive peers, bounding retention to one minute.
        for key in list(self.buckets):
            existing = self.buckets[key]
            while existing and existing[0] <= now - 60:
                existing.popleft()
            if not existing:
                del self.buckets[key]
        bucket = self.buckets.get(peer)
        if bucket is None:
            # Fail closed rather than allowing unbounded memory allocation.
            if len(self.buckets) >= 10000:
                return 60
            bucket = self.buckets[peer] = deque()
        if len(bucket) >= self.limit:
            return max(1, math.ceil(60 - (now - bucket[0])))
        bucket.append(now)
        return 0


def create_app(
    settings: Settings | None = None,
    *,
    engine: AsyncEngine | None = None,
    mailer: Delivery | None = None,
) -> FastAPI:
    settings = settings or Settings()
    owns_engine = engine is None
    engine = engine or make_engine(settings)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    limiter = PublicLimiter(settings.public_rate_limit)
    mailer = mailer or SMTPDelivery(settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        task = None
        if settings.identity_enabled:
            from clinic_backend.identity_cleanup import cleanup_loop

            task = asyncio.create_task(cleanup_loop(sessions, settings))
        try:
            yield
        finally:
            if task:
                task.cancel()
                with suppress(asyncio.CancelledError):
                    await task
            await mailer.close()
            if owns_engine:
                await engine.dispose()

    app = FastAPI(
        title="Agentic Clinic — Phase 1 Backend", version="0.2.0", lifespan=lifespan
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"^http://(localhost|127\.0\.0\.1)(:\d+)?$",
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def correlation(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response: Response
        supplied = request.headers.get("X-Request-Id", "")
        request.state.request_id = (
            supplied
            if re.fullmatch(r"[A-Za-z0-9._-]{1,128}", supplied)
            else uuid4().hex
        )
        if request.url.path.startswith(
            ("/api/v1/doctors", "/api/v1/services", "/api/v1/specialties")
        ):
            retry = limiter.retry_after(
                request.client.host if request.client else "unknown"
            )
            if retry:
                response = error_response(
                    request, 429, "RATE_LIMITED", "Too many requests. Try again later."
                )
                response.headers["Retry-After"] = str(retry)
                return response
        try:
            response = await call_next(request)
        except (SQLAlchemyError, OSError, TimeoutError):
            response = error_response(
                request, 503, "SERVICE_UNAVAILABLE", "Service temporarily unavailable."
            )
        except Exception as exc:
            logger.error(
                "Unhandled request error request_id=%s type=%s",
                request.state.request_id,
                type(exc).__name__,
            )
            response = error_response(
                request, 500, "INTERNAL_ERROR", "An unexpected error occurred."
            )
        response.headers["X-Request-Id"] = request.state.request_id
        return response

    @app.exception_handler(APIError)
    async def api_error(request: Request, exc: APIError) -> Response:
        response = error_response(
            request, exc.status, exc.code, exc.message, exc.details
        )
        if exc.status == 429 and exc.details:
            response.headers["Retry-After"] = str(exc.details.get("retry_after", 60))
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.exception_handler(RequestValidationError)
    async def validation_error(
        request: Request, exc: RequestValidationError
    ) -> Response:
        known_fields = {
            "specialty_id",
            "q",
            "limit",
            "offset",
            "category",
            "doctor_id",
            "service_id",
            "channel",
            "event",
            "full_name",
            "phone",
            "date_of_birth",
            "email",
            "preferred_language",
            "privacy_notice_accepted",
            "purpose",
            "code",
            "customer_number",
        }
        fields = []
        for problem in exc.errors():
            location = problem["loc"]
            # Unknown field names can themselves contain secrets. Only return
            # contract-owned identifiers and Pydantic's stable reason codes.
            field = ".".join(
                str(part)
                for part in location
                if part in known_fields or part in {"query", "path", "body"}
            )
            fields.append({"field": field or "request", "reason": problem["type"]})
        return error_response(
            request,
            400,
            "VALIDATION_FAILED",
            "Invalid request parameters.",
            {"fields": fields},
        )

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException) -> Response:
        return error_response(
            request,
            exc.status_code,
            "NOT_FOUND" if exc.status_code == 404 else "HTTP_ERROR",
            (
                "Resource not found."
                if exc.status_code == 404
                else "Request could not be processed."
            ),
        )

    async def catalog() -> AsyncIterator[Catalog]:
        async with sessions() as session:
            yield Catalog(session)

    async def no_query(request: Request) -> None:
        if request.query_params:
            raise APIError(
                400,
                "VALIDATION_FAILED",
                "Unexpected query parameters.",
                {"fields": [{"field": "query", "reason": "unknown_fields"}]},
            )

    errors: dict[int | str, dict[str, Any]] = {
        400: {"model": ErrorEnvelope},
        429: {"model": ErrorEnvelope},
        503: {"model": ErrorEnvelope},
    }

    @app.get("/api/v1/health", response_model=Health, dependencies=[Depends(no_query)])
    async def health() -> Health:
        return Health(status="ok")

    @app.get(
        "/api/v1/health/ready",
        response_model=Health,
        responses={503: {"model": ErrorEnvelope}},
        dependencies=[Depends(no_query)],
    )
    async def ready() -> Health:
        if not await is_ready(engine, settings):
            raise APIError(503, "SERVICE_UNAVAILABLE", "Service is not ready.")
        return Health(status="ready")

    @app.get(
        "/api/v1/specialties",
        response_model=dto.SpecialtyList,
        responses=errors,
        dependencies=[Depends(no_query)],
    )
    async def specialties(
        store: Annotated[Catalog, Depends(catalog)],
    ) -> dto.SpecialtyList:
        return await store.specialties()

    @app.get("/api/v1/doctors", response_model=dto.DoctorList, responses=errors)
    async def doctors(
        query: Annotated[dto.DoctorQuery, Query()],
        store: Annotated[Catalog, Depends(catalog)],
    ) -> dto.DoctorList:
        return await store.doctors(query)

    @app.get(
        "/api/v1/doctors/{doctor_id}",
        response_model=dto.DoctorDetail,
        responses={**errors, 404: {"model": ErrorEnvelope}},
        dependencies=[Depends(no_query)],
    )
    async def doctor(
        doctor_id: Annotated[int, Path(gt=0, le=dto.MAX_CATALOG_ID)],
        store: Annotated[Catalog, Depends(catalog)],
    ) -> dto.DoctorDetail:
        item = await store.doctor(doctor_id)
        if item is None:
            raise APIError(404, "DOCTOR_NOT_FOUND", "Doctor not found.")
        return item

    @app.get("/api/v1/services", response_model=dto.ServiceList, responses=errors)
    async def services(
        query: Annotated[dto.ServiceQuery, Query()],
        store: Annotated[Catalog, Depends(catalog)],
    ) -> dto.ServiceList:
        return await store.services(query)

    @app.get(
        "/api/v1/services/{service_id}",
        response_model=dto.ServiceDetail,
        responses={**errors, 404: {"model": ErrorEnvelope}},
        dependencies=[Depends(no_query)],
    )
    async def service(
        service_id: Annotated[int, Path(gt=0, le=dto.MAX_CATALOG_ID)],
        store: Annotated[Catalog, Depends(catalog)],
    ) -> dto.ServiceDetail:
        item = await store.service(service_id)
        if item is None:
            raise APIError(404, "SERVICE_NOT_FOUND", "Service not found.")
        return item

    @app.get("/api/v1/patients", tags=["Patients"])
    async def list_patients(
        q: str | None = Query(default=None),
        limit: int = Query(default=50, ge=1, le=100),
        offset: int = Query(default=0, ge=0),
    ) -> dict[str, Any]:
        async with sessions() as session:
            stmt = select(Patient)
            if q and q.strip():
                term = f"%{q.strip()}%"
                stmt = stmt.where(
                    (Patient.full_name.ilike(term))
                    | (Patient.phone.like(term))
                    | (Patient.customer_number.like(term))
                    | (Patient.email.ilike(term))
                )
            count_stmt = select(func.count()).select_from(stmt.subquery())
            total = await session.scalar(count_stmt) or 0

            stmt = stmt.order_by(Patient.created_at.desc()).offset(offset).limit(limit)
            result = await session.scalars(stmt)
            rows = result.all()

            return {
                "total": total,
                "patients": [
                    {
                        "id": p.id,
                        "customer_number": p.customer_number,
                        "full_name": p.full_name,
                        "email": p.email,
                        "phone": p.phone,
                        "date_of_birth": (
                            p.date_of_birth.isoformat() if p.date_of_birth else None
                        ),
                        "preferred_language": p.preferred_language,
                        "gender": p.gender,
                        "insurance_provider": p.insurance_provider,
                        "insurance_policy_number": p.insurance_policy_number,
                        "created_at": (
                            p.created_at.isoformat() if p.created_at else None
                        ),
                        "updated_at": (
                            p.updated_at.isoformat() if p.updated_at else None
                        ),
                    }
                    for p in rows
                ],
            }

    @app.get("/api/v1/patients/{patient_id}", tags=["Patients"])
    async def get_patient_detail(patient_id: str) -> dict[str, Any]:
        async with sessions() as session:
            stmt = select(Patient)
            if patient_id.isdigit():
                stmt = stmt.where(or_(Patient.id == int(patient_id), Patient.customer_number == patient_id))
            else:
                stmt = stmt.where(Patient.customer_number == patient_id)
            patient = await session.scalar(stmt)
            if not patient:
                raise APIError(404, "PATIENT_NOT_FOUND", "Patient not found.")
            return {
                "id": patient.id,
                "customer_number": patient.customer_number,
                "full_name": patient.full_name,
                "email": patient.email,
                "phone": patient.phone,
                "date_of_birth": (
                    patient.date_of_birth.isoformat() if patient.date_of_birth else None
                ),
                "preferred_language": patient.preferred_language,
                "gender": patient.gender,
                "insurance_provider": patient.insurance_provider,
                "insurance_policy_number": patient.insurance_policy_number,
                "created_at": (
                    patient.created_at.isoformat() if patient.created_at else None
                ),
                "updated_at": (
                    patient.updated_at.isoformat() if patient.updated_at else None
                ),
            }

    @app.post("/api/v1/patients", tags=["Patients"])
    async def create_patient(payload: dict[str, Any]) -> dict[str, Any]:
        import random
        from datetime import date as dt_date, datetime, timezone

        full_name = str(payload.get("full_name") or payload.get("name") or "").strip()
        phone = str(payload.get("phone") or "").strip()
        email = str(payload.get("email") or "").strip().lower()
        if not full_name or not phone:
            raise APIError(400, "INVALID_INPUT", "Full name and phone are required.")

        if not phone.startswith("+"):
            phone = f"+{phone}"

        gender = str(payload.get("gender") or "male").strip().lower()
        if gender not in ("male", "female"):
            gender = "male"

        raw_dob = payload.get("date_of_birth") or payload.get("dob")
        dob = None
        if raw_dob:
            try:
                dob = dt_date.fromisoformat(str(raw_dob)[:10])
            except Exception:
                dob = None
        if not dob:
            dob = dt_date(2000, 1, 1)

        async with sessions() as session:
            for _ in range(20):
                candidate_num = f"{random.randint(100000, 999999)}"
                existing = await session.scalar(
                    select(Patient).where(Patient.customer_number == candidate_num)
                )
                if not existing:
                    break
            else:
                candidate_num = f"{random.randint(100000, 999999)}"

            now = datetime.now(timezone.utc)
            patient = Patient(
                customer_number=candidate_num,
                full_name=full_name,
                email=email or f"patient.{candidate_num}@clinic.local",
                email_verified_at=now,
                phone=phone,
                date_of_birth=dob,
                preferred_language="ar" if payload.get("preferred_language") == "ar" else "en",
                gender=gender,
                insurance_provider=payload.get("insurance_provider"),
                insurance_policy_number=payload.get("insurance_policy_number"),
                created_at=now,
                updated_at=now,
            )
            session.add(patient)
            await session.commit()
            await session.refresh(patient)

            await ws_manager.broadcast(
                "PATIENT_CREATED",
                {
                    "id": patient.id,
                    "customer_number": patient.customer_number,
                    "full_name": patient.full_name,
                },
            )

            return {
                "id": patient.id,
                "customer_number": patient.customer_number,
                "full_name": patient.full_name,
                "email": patient.email,
                "phone": patient.phone,
                "date_of_birth": patient.date_of_birth.isoformat() if patient.date_of_birth else None,
                "preferred_language": patient.preferred_language,
                "gender": patient.gender,
                "insurance_provider": patient.insurance_provider,
                "insurance_policy_number": patient.insurance_policy_number,
                "created_at": patient.created_at.isoformat() if patient.created_at else None,
                "updated_at": patient.updated_at.isoformat() if patient.updated_at else None,
            }

    @app.put("/api/v1/patients/{patient_id}", tags=["Patients"])
    async def update_patient(patient_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        from datetime import datetime, timezone

        async with sessions() as session:
            stmt = select(Patient)
            if patient_id.isdigit():
                stmt = stmt.where(or_(Patient.id == int(patient_id), Patient.customer_number == patient_id))
            else:
                stmt = stmt.where(Patient.customer_number == patient_id)
            patient = await session.scalar(stmt)
            if not patient:
                raise APIError(404, "PATIENT_NOT_FOUND", "Patient not found.")

            if "full_name" in payload or "name" in payload:
                patient.full_name = str(payload.get("full_name") or payload.get("name")).strip()
            if "phone" in payload:
                new_phone = str(payload["phone"]).strip()
                if not new_phone.startswith("+"):
                    new_phone = f"+{new_phone}"
                patient.phone = new_phone
            if "email" in payload and payload["email"]:
                patient.email = str(payload["email"]).strip().lower()
            if "gender" in payload and str(payload["gender"]).lower() in ("male", "female"):
                patient.gender = str(payload["gender"]).lower()
            if "insurance_provider" in payload:
                patient.insurance_provider = str(payload["insurance_provider"]).strip() if payload["insurance_provider"] else None
            if "insurance_policy_number" in payload:
                patient.insurance_policy_number = str(payload["insurance_policy_number"]).strip() if payload["insurance_policy_number"] else None
            if "date_of_birth" in payload or "dob" in payload:
                raw_dob = payload.get("date_of_birth") or payload.get("dob")
                if raw_dob:
                    try:
                        from datetime import date as dt_date
                        patient.date_of_birth = dt_date.fromisoformat(str(raw_dob)[:10])
                    except Exception:
                        pass
            if "preferred_language" in payload and str(payload["preferred_language"]).lower() in ("ar", "en"):
                patient.preferred_language = str(payload["preferred_language"]).lower()

            patient.updated_at = datetime.now(timezone.utc)
            await session.commit()
            await session.refresh(patient)

            await ws_manager.broadcast(
                "PATIENT_UPDATED",
                {
                    "id": patient.id,
                    "customer_number": patient.customer_number,
                    "full_name": patient.full_name,
                },
            )

            return {
                "id": patient.id,
                "customer_number": patient.customer_number,
                "full_name": patient.full_name,
                "email": patient.email,
                "phone": patient.phone,
                "date_of_birth": patient.date_of_birth.isoformat() if patient.date_of_birth else None,
                "preferred_language": patient.preferred_language,
                "gender": patient.gender,
                "insurance_provider": patient.insurance_provider,
                "insurance_policy_number": patient.insurance_policy_number,
                "created_at": patient.created_at.isoformat() if patient.created_at else None,
                "updated_at": patient.updated_at.isoformat() if patient.updated_at else None,
            }

    @app.websocket("/api/v1/ws")
    @app.websocket("/ws")
    async def websocket_realtime_endpoint(websocket: WebSocket) -> None:
        await ws_manager.connect(websocket)
        try:
            from datetime import datetime, timezone

            await websocket.send_json(
                {
                    "event": "CONNECTED",
                    "data": {
                        "status": "ready",
                        "server_time": datetime.now(timezone.utc).isoformat(),
                    },
                }
            )
            while True:
                data = await websocket.receive_text()
                if data == "ping":
                    await websocket.send_text("pong")
                elif data == "heartbeat":
                    await websocket.send_json({"event": "PONG"})
        except (WebSocketDisconnect, Exception):
            await ws_manager.disconnect(websocket)

    @app.post("/api/v1/ws/broadcast", tags=["Realtime"])
    async def broadcast_realtime_event(payload: dict[str, Any]) -> dict[str, Any]:
        event_type = str(payload.get("event") or "SYSTEM_NOTIFICATION")
        data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
        await ws_manager.broadcast(event_type, data)
        return {
            "status": "broadcasted",
            "active_clients": len(ws_manager.active_connections),
        }

    app.include_router(conversation_router(sessions, settings))
    if settings.identity_enabled:
        from clinic_backend.identity_routes import identity_router

        app.include_router(identity_router(sessions, settings, mailer))
        static = FilePath(__file__).parent / "static"
        app.mount(
            "/identity-assets", StaticFiles(directory=static), name="identity-assets"
        )

        @app.get("/register", include_in_schema=False)
        async def registration_page() -> Response:
            return FileResponse(
                static / "register.html",
                headers={
                    "Cache-Control": "no-store",
                    "Content-Security-Policy": (
                        "default-src 'self'; frame-ancestors 'none'; "
                        "base-uri 'none'; form-action 'self'"
                    ),
                    "X-Content-Type-Options": "nosniff",
                    "Referrer-Policy": "no-referrer",
                },
            )

    # FastAPI defaults to a 422 validation response. This catalog contract uses
    # our sanitized 400 envelope; keep the review UI aligned with actual behavior.
    schema = app.openapi()
    for path_item in schema["paths"].values():
        for operation in path_item.values():
            if (
                operation.get("responses", {}).get("422", {}).get("description")
                == "Validation Error"
            ):
                operation["responses"].pop("422", None)
    return app
