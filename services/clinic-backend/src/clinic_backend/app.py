import asyncio
import logging
import math
import re
import secrets
import time
from collections import deque
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager, suppress
from datetime import UTC, datetime, timedelta
from datetime import date as dt_date
from datetime import time as dt_time
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
from sqlalchemy import func, or_, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker
from starlette.exceptions import HTTPException
from starlette.responses import FileResponse, Response
from starlette.staticfiles import StaticFiles

from clinic_backend.availability_routes import availability_router
from clinic_backend.catalog import Catalog
from clinic_backend.conversations import conversation_router
from clinic_backend.database import is_ready, make_engine
from clinic_backend.errors import APIError, ErrorEnvelope, error_response
from clinic_backend.identity_models import Patient
from clinic_backend.mail import Delivery, make_delivery
from clinic_backend.settings import Settings
from clinic_backend.supabase_auth import AuthClient
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
    clock: Callable[[], datetime] | None = None,
    auth_client: AuthClient | None = None,
) -> FastAPI:
    settings = settings or Settings()
    owns_engine = engine is None
    engine = engine or make_engine(settings)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    limiter = PublicLimiter(settings.public_rate_limit)
    mailer = mailer or make_delivery(settings)

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
        path = request.url.path
        privileged = (
            path == "/api/v1/admin"
            or path.startswith("/api/v1/admin/")
            or path == "/api/v1/appointments"
            or path.startswith("/api/v1/appointments/")
            or path == "/api/v1/ws/broadcast"
            or (path == "/api/v1/doctors" and request.method == "POST")
        )
        if privileged and request.method != "OPTIONS":
            expected = settings.admin_api_token
            supplied = request.headers.get("X-Admin-Token", "")
            if expected is None or not secrets.compare_digest(
                supplied.encode(), expected.get_secret_value().encode()
            ):
                response = error_response(
                    request,
                    403 if expected is None else 401,
                    "ACTION_NOT_ALLOWED" if expected is None else "ADMIN_AUTH_REQUIRED",
                    "Administrator authentication required.",
                )
                response.headers["X-Request-Id"] = request.state.request_id
                return response
        if request.url.path.startswith(
            (
                "/api/v1/doctors",
                "/api/v1/services",
                "/api/v1/specialties",
                "/api/v1/availability",
                "/api/v1/auth",
            )
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
        except (SQLAlchemyError, OSError, TimeoutError) as exc:
            logger.error(
                "Database or IO error request_id=%s type=%s",
                request.state.request_id,
                type(exc).__name__,
            )
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

    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"^http://(localhost|127\.0\.0\.1)(:\d+)?$",
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

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
            "from_date",
            "to_date",
            "earliest_time",
            "latest_time",
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

    @app.post("/api/v1/doctors", status_code=201, tags=["Doctors"])
    async def create_doctor(payload: dict[str, Any]) -> dict[str, Any]:
        from datetime import time as dt_time
        from decimal import Decimal

        from clinic_backend.models import Doctor, Specialty

        name_en = str(payload.get("name_en") or "").strip()
        name_ar = str(payload.get("name_ar") or "").strip()
        title_en = str(payload.get("title_en") or "Consultant").strip()
        title_ar = str(payload.get("title_ar") or "استشاري").strip()
        specialty_id = payload.get("specialty_id")
        fee_raw = payload.get("consultation_fee") or payload.get("fee") or 350.0

        if not name_en or not name_ar or not specialty_id:
            raise APIError(
                400, "INVALID_INPUT", "name_en, name_ar, and specialty_id are required."
            )

        try:
            specialty_id = int(specialty_id)
        except (ValueError, TypeError):
            raise APIError(400, "INVALID_INPUT", "specialty_id must be an integer.")

        try:
            consultation_fee = Decimal(str(fee_raw))
        except Exception:
            consultation_fee = Decimal("350.00")

        bio_en = str(
            payload.get("bio_en")
            or f"Experienced {title_en} specializing in clinic care."
        ).strip()
        bio_ar = str(
            payload.get("bio_ar") or "استشاري متخصص في الرعاية الطبية."
        ).strip()
        languages = payload.get("languages") or ["ar", "en"]

        raw_start = str(payload.get("shift_start") or "09:00").strip()
        raw_end = str(payload.get("shift_end") or "17:00").strip()
        try:
            sh_h, sh_m = map(int, raw_start.split(":")[:2])
            shift_start = dt_time(sh_h, 0 if sh_m < 15 else 30)
        except Exception:
            shift_start = dt_time(9, 0)

        try:
            eh_h, eh_m = map(int, raw_end.split(":")[:2])
            shift_end = dt_time(eh_h, 0 if eh_m < 15 else 30)
        except Exception:
            shift_end = dt_time(17, 0)

        if shift_end <= shift_start:
            shift_end = dt_time(min(shift_start.hour + 4, 21), 0)

        working_days = payload.get("working_days") or [1, 2, 3, 4, 6, 7]
        valid_days = [d for d in working_days if d in (1, 2, 3, 4, 6, 7)]
        if not valid_days:
            valid_days = [1, 2, 3, 4, 6, 7]

        async with sessions() as session:
            spec = await session.get(Specialty, specialty_id)
            if not spec:
                raise APIError(
                    404, "SPECIALTY_NOT_FOUND", "Selected specialty does not exist."
                )

            new_doc = Doctor(
                name_en=name_en,
                name_ar=name_ar,
                title_en=title_en,
                title_ar=title_ar,
                specialty_id=specialty_id,
                bio_en=bio_en,
                bio_ar=bio_ar,
                languages=languages,
                consultation_fee=consultation_fee,
                working_days=valid_days,
                shift_start=shift_start,
                shift_end=shift_end,
                is_active=True,
            )
            session.add(new_doc)
            await session.commit()
            await session.refresh(new_doc)

            # Invalidate caches
            if hasattr(app.state, "cache"):
                await app.state.cache.clear()

            return {
                "id": new_doc.id,
                "name_en": new_doc.name_en,
                "name_ar": new_doc.name_ar,
                "title_en": new_doc.title_en,
                "title_ar": new_doc.title_ar,
                "specialty": {
                    "id": spec.id,
                    "name_en": spec.name_en,
                    "name_ar": spec.name_ar,
                },
                "specialty_id": spec.id,
                "languages": new_doc.languages,
                "consultation_fee": {
                    "amount": float(new_doc.consultation_fee),
                    "currency": "EGP",
                },
                "working_days": [
                    {1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 6: "Sat", 7: "Sun"}.get(
                        d, str(d)
                    )
                    for d in new_doc.working_days
                ],
                "working_hours": {
                    "start": new_doc.shift_start.strftime("%H:%M"),
                    "end": new_doc.shift_end.strftime("%H:%M"),
                },
                "is_active": new_doc.is_active,
            }

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

    @app.get("/api/v1/admin/patients", tags=["Patients"])
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

            if total == 0:
                try:
                    raw_check = await session.execute(
                        text(
                            "SELECT id, customer_number, full_name, email, phone, "
                            "date_of_birth, "
                            "preferred_language, gender, insurance_provider, "
                            "insurance_policy_number, "
                            "created_at, updated_at FROM clinic.patients ORDER BY id "
                            "DESC LIMIT :limit OFFSET :offset"
                        ),
                        {"limit": limit, "offset": offset},
                    )
                    raw_rows = raw_check.mappings().all()
                    if raw_rows:
                        total_res = await session.scalar(
                            text("SELECT count(*) FROM clinic.patients")
                        )
                        return {
                            "total": total_res or len(raw_rows),
                            "patients": [
                                {
                                    "id": r["id"],
                                    "customer_number": r["customer_number"],
                                    "full_name": r["full_name"],
                                    "email": r["email"],
                                    "phone": r["phone"],
                                    "date_of_birth": (
                                        r["date_of_birth"].isoformat()
                                        if r["date_of_birth"]
                                        else None
                                    ),
                                    "preferred_language": r.get(
                                        "preferred_language", "en"
                                    ),
                                    "gender": r.get("gender"),
                                    "address": r.get("address"),
                                    "blood_type": r.get("blood_type"),
                                    "allergies": r.get("allergies"),
                                    "chronic_conditions": r.get("chronic_conditions"),
                                    "preferred_pharmacy": r.get("preferred_pharmacy"),
                                    "emergency_contact_name": r.get(
                                        "emergency_contact_name"
                                    ),
                                    "emergency_contact_phone": r.get(
                                        "emergency_contact_phone"
                                    ),
                                    "insurance_provider": r.get("insurance_provider"),
                                    "insurance_policy_number": r.get(
                                        "insurance_policy_number"
                                    ),
                                    "created_at": (
                                        r["created_at"].isoformat()
                                        if r["created_at"]
                                        else None
                                    ),
                                    "updated_at": (
                                        r["updated_at"].isoformat()
                                        if r["updated_at"]
                                        else None
                                    ),
                                }
                                for r in raw_rows
                            ],
                        }
                except Exception as exc:
                    logger.debug("clinic.patients query fallback: %s", exc)

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
                        "address": getattr(p, "address", None),
                        "blood_type": getattr(p, "blood_type", None),
                        "allergies": getattr(p, "allergies", None),
                        "chronic_conditions": getattr(p, "chronic_conditions", None),
                        "preferred_pharmacy": getattr(p, "preferred_pharmacy", None),
                        "emergency_contact_name": getattr(
                            p, "emergency_contact_name", None
                        ),
                        "emergency_contact_phone": getattr(
                            p, "emergency_contact_phone", None
                        ),
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

    @app.get("/api/v1/admin/patients/{patient_id}", tags=["Patients"])
    async def get_patient_detail(patient_id: str) -> dict[str, Any]:
        async with sessions() as session:
            stmt = select(Patient)
            if patient_id.isdigit():
                stmt = stmt.where(
                    or_(
                        Patient.id == int(patient_id),
                        Patient.customer_number == patient_id,
                    )
                )
            else:
                stmt = stmt.where(Patient.customer_number == patient_id)
            patient = await session.scalar(stmt)
            if not patient:
                try:
                    raw_check = await session.execute(
                        text(
                            "SELECT id, customer_number, full_name, email, phone, "
                            "date_of_birth, "
                            "preferred_language, gender, insurance_provider, "
                            "insurance_policy_number, "
                            "created_at, updated_at FROM clinic.patients "
                            "WHERE customer_number = :pid OR id::text = :pid LIMIT 1"
                        ),
                        {"pid": patient_id},
                    )
                    r = raw_check.mappings().first()
                    if r:
                        return {
                            "id": r["id"],
                            "customer_number": r["customer_number"],
                            "full_name": r["full_name"],
                            "email": r["email"],
                            "phone": r["phone"],
                            "date_of_birth": (
                                r["date_of_birth"].isoformat()
                                if r["date_of_birth"]
                                else None
                            ),
                            "preferred_language": r.get("preferred_language", "en"),
                            "gender": r.get("gender"),
                            "address": r.get("address"),
                            "blood_type": r.get("blood_type"),
                            "allergies": r.get("allergies"),
                            "chronic_conditions": r.get("chronic_conditions"),
                            "preferred_pharmacy": r.get("preferred_pharmacy"),
                            "emergency_contact_name": r.get("emergency_contact_name"),
                            "emergency_contact_phone": r.get("emergency_contact_phone"),
                            "insurance_provider": r.get("insurance_provider"),
                            "insurance_policy_number": r.get("insurance_policy_number"),
                            "created_at": (
                                r["created_at"].isoformat() if r["created_at"] else None
                            ),
                            "updated_at": (
                                r["updated_at"].isoformat() if r["updated_at"] else None
                            ),
                        }
                except Exception as exc:
                    logger.debug("clinic.patients detail query fallback: %s", exc)
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
                "address": getattr(patient, "address", None),
                "blood_type": getattr(patient, "blood_type", None),
                "allergies": getattr(patient, "allergies", None),
                "chronic_conditions": getattr(patient, "chronic_conditions", None),
                "preferred_pharmacy": getattr(patient, "preferred_pharmacy", None),
                "emergency_contact_name": getattr(
                    patient, "emergency_contact_name", None
                ),
                "emergency_contact_phone": getattr(
                    patient, "emergency_contact_phone", None
                ),
                "insurance_provider": patient.insurance_provider,
                "insurance_policy_number": patient.insurance_policy_number,
                "created_at": (
                    patient.created_at.isoformat() if patient.created_at else None
                ),
                "updated_at": (
                    patient.updated_at.isoformat() if patient.updated_at else None
                ),
            }

    @app.post("/api/v1/admin/patients", tags=["Patients"])
    async def create_patient(payload: dict[str, Any]) -> dict[str, Any]:
        import random
        from datetime import date as dt_date
        from datetime import datetime

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

            now = datetime.now(UTC)
            patient = Patient(
                customer_number=candidate_num,
                full_name=full_name,
                email=email or f"patient.{candidate_num}@clinic.local",
                email_verified_at=now,
                phone=phone,
                date_of_birth=dob,
                preferred_language=(
                    "ar" if payload.get("preferred_language") == "ar" else "en"
                ),
                gender=gender,
                address=str(payload.get("address") or "").strip() or None,
                blood_type=str(
                    payload.get("blood_type") or payload.get("bloodType") or ""
                ).strip()
                or None,
                allergies=str(payload.get("allergies") or "").strip() or None,
                chronic_conditions=str(
                    payload.get("chronic_conditions")
                    or payload.get("chronicConditions")
                    or ""
                ).strip()
                or None,
                preferred_pharmacy=str(
                    payload.get("preferred_pharmacy") or payload.get("pharmacy") or ""
                ).strip()
                or None,
                emergency_contact_name=str(
                    payload.get("emergency_contact_name") or ""
                ).strip()
                or None,
                emergency_contact_phone=str(
                    payload.get("emergency_contact_phone") or ""
                ).strip()
                or None,
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
                "date_of_birth": (
                    patient.date_of_birth.isoformat() if patient.date_of_birth else None
                ),
                "preferred_language": patient.preferred_language,
                "gender": patient.gender,
                "address": patient.address,
                "blood_type": patient.blood_type,
                "allergies": patient.allergies,
                "chronic_conditions": patient.chronic_conditions,
                "preferred_pharmacy": patient.preferred_pharmacy,
                "emergency_contact_name": patient.emergency_contact_name,
                "emergency_contact_phone": patient.emergency_contact_phone,
                "insurance_provider": patient.insurance_provider,
                "insurance_policy_number": patient.insurance_policy_number,
                "created_at": (
                    patient.created_at.isoformat() if patient.created_at else None
                ),
                "updated_at": (
                    patient.updated_at.isoformat() if patient.updated_at else None
                ),
            }

    @app.put("/api/v1/admin/patients/{patient_id}", tags=["Patients"])
    async def update_patient(
        patient_id: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        from datetime import datetime

        async with sessions() as session:
            stmt = select(Patient)
            if patient_id.isdigit():
                stmt = stmt.where(
                    or_(
                        Patient.id == int(patient_id),
                        Patient.customer_number == patient_id,
                    )
                )
            else:
                stmt = stmt.where(Patient.customer_number == patient_id)
            patient = await session.scalar(stmt)
            if not patient:
                raise APIError(404, "PATIENT_NOT_FOUND", "Patient not found.")

            if "full_name" in payload or "name" in payload:
                patient.full_name = str(
                    payload.get("full_name") or payload.get("name")
                ).strip()
            if "phone" in payload:
                new_phone = str(payload["phone"]).strip()
                if not new_phone.startswith("+"):
                    new_phone = f"+{new_phone}"
                patient.phone = new_phone
            if "email" in payload and payload["email"]:
                patient.email = str(payload["email"]).strip().lower()
            if "gender" in payload and str(payload["gender"]).lower() in (
                "male",
                "female",
            ):
                patient.gender = str(payload["gender"]).lower()
            if "address" in payload:
                patient.address = str(payload["address"]).strip() or None
            if "blood_type" in payload or "bloodType" in payload:
                patient.blood_type = (
                    str(
                        payload.get("blood_type") or payload.get("bloodType") or ""
                    ).strip()
                    or None
                )
            if "allergies" in payload:
                patient.allergies = str(payload["allergies"]).strip() or None
            if "chronic_conditions" in payload or "chronicConditions" in payload:
                patient.chronic_conditions = (
                    str(
                        payload.get("chronic_conditions")
                        or payload.get("chronicConditions")
                        or ""
                    ).strip()
                    or None
                )
            if "preferred_pharmacy" in payload or "pharmacy" in payload:
                patient.preferred_pharmacy = (
                    str(
                        payload.get("preferred_pharmacy")
                        or payload.get("pharmacy")
                        or ""
                    ).strip()
                    or None
                )
            if "emergency_contact_name" in payload:
                patient.emergency_contact_name = (
                    str(payload["emergency_contact_name"]).strip() or None
                )
            if "emergency_contact_phone" in payload:
                patient.emergency_contact_phone = (
                    str(payload["emergency_contact_phone"]).strip() or None
                )
            if "insurance_provider" in payload:
                patient.insurance_provider = (
                    str(payload["insurance_provider"]).strip()
                    if payload["insurance_provider"]
                    else None
                )
            if "insurance_policy_number" in payload:
                patient.insurance_policy_number = (
                    str(payload["insurance_policy_number"]).strip()
                    if payload["insurance_policy_number"]
                    else None
                )
            if "date_of_birth" in payload or "dob" in payload:
                raw_dob = payload.get("date_of_birth") or payload.get("dob")
                if raw_dob:
                    try:
                        from datetime import date as dt_date

                        patient.date_of_birth = dt_date.fromisoformat(str(raw_dob)[:10])
                    except Exception:
                        pass
            if "preferred_language" in payload and str(
                payload["preferred_language"]
            ).lower() in ("ar", "en"):
                patient.preferred_language = str(payload["preferred_language"]).lower()

            patient.updated_at = datetime.now(UTC)
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
                "date_of_birth": (
                    patient.date_of_birth.isoformat() if patient.date_of_birth else None
                ),
                "preferred_language": patient.preferred_language,
                "gender": patient.gender,
                "address": patient.address,
                "blood_type": patient.blood_type,
                "allergies": patient.allergies,
                "chronic_conditions": patient.chronic_conditions,
                "preferred_pharmacy": patient.preferred_pharmacy,
                "emergency_contact_name": patient.emergency_contact_name,
                "emergency_contact_phone": patient.emergency_contact_phone,
                "insurance_provider": patient.insurance_provider,
                "insurance_policy_number": patient.insurance_policy_number,
                "created_at": (
                    patient.created_at.isoformat() if patient.created_at else None
                ),
                "updated_at": (
                    patient.updated_at.isoformat() if patient.updated_at else None
                ),
            }

    @app.websocket("/api/v1/ws")
    @app.websocket("/ws")
    async def websocket_realtime_endpoint(websocket: WebSocket) -> None:
        await websocket.accept()
        expected = settings.admin_api_token
        if expected is not None:
            try:
                message = await asyncio.wait_for(websocket.receive_json(), timeout=10)
                supplied = message.get("token", "") if isinstance(message, dict) else ""
                if (
                    not isinstance(supplied, str)
                    or not secrets.compare_digest(
                        supplied.encode(), expected.get_secret_value().encode()
                    )
                ):
                    await websocket.close(code=4401)
                    return
            except Exception:
                await websocket.close(code=4401)
                return
        else:
            # When admin_api_token is not configured, send CONNECTED immediately
            await websocket.send_json({"event": "CONNECTED", "data": {"status": "ready"}})
        await ws_manager.connect(websocket, accepted=True)
        try:
            from datetime import datetime

            await websocket.send_json(
                {
                    "event": "CONNECTED",
                    "data": {
                        "status": "ready",
                        "server_time": datetime.now(UTC).isoformat(),
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

    # =========================================================================
    # APPOINTMENTS REST API (LIVE SUPABASE / POSTGRESQL ONLY)
    # =========================================================================
    @app.get("/api/v1/appointments", tags=["Appointments"])
    async def list_appointments(
        date: dt_date | None = None,
        doctor_id: int | None = None,
        patient_id: int | None = None,
        status: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> dict[str, Any]:
        from clinic_backend.models import Doctor, Specialty
        from clinic_backend.scheduling_models import Appointment

        async with sessions() as session:
            stmt = (
                select(Appointment, Doctor, Patient, Specialty)
                .join(Doctor, Appointment.doctor_id == Doctor.id, isouter=True)
                .join(Patient, Appointment.patient_id == Patient.id, isouter=True)
                .join(Specialty, Doctor.specialty_id == Specialty.id, isouter=True)
            )
            if date:
                stmt = stmt.where(Appointment.appointment_date == date)
            if doctor_id:
                stmt = stmt.where(Appointment.doctor_id == doctor_id)
            if patient_id:
                stmt = stmt.where(Appointment.patient_id == patient_id)
            if status:
                stmt = stmt.where(Appointment.status == status.lower())

            stmt = stmt.order_by(
                Appointment.appointment_date.desc(), Appointment.start_time.asc()
            )
            stmt = stmt.offset(offset).limit(limit)

            rows = (await session.execute(stmt)).all()
            results = []
            for appt, doc, pat, spec in rows:
                start_str = appt.start_time.strftime("%H:%M")
                end_str = appt.end_time.strftime("%H:%M")
                # Format 12-hour short string
                start_dt = datetime.combine(appt.appointment_date, appt.start_time)
                time_short = start_dt.strftime("%I:%M %p").lstrip("0")
                if time_short.startswith(":"):
                    time_short = "0" + time_short

                p_name = pat.full_name if pat else "Unknown Patient"
                p_code = (
                    pat.customer_number
                    if pat
                    else (f"PT-{appt.patient_id}" if appt.patient_id else "")
                )
                p_phone = pat.phone if pat else ""

                status_formatted = (
                    appt.status.capitalize() if appt.status else "Scheduled"
                )
                if status_formatted == "Scheduled":
                    status_formatted = "Confirmed"

                results.append(
                    {
                        "id": appt.id,
                        "patient_id": appt.patient_id,
                        "patientName": p_name,
                        "patient_name": p_name,
                        "patientPhone": p_phone,
                        "patient_phone": p_phone,
                        "patientCode": p_code,
                        "patient_code": p_code,
                        "patientAvatar": p_name[0].upper() if p_name else "P",
                        "patientAvatarBg": "#EFF6FF",
                        "patientAvatarColor": "#2563EB",
                        "doctor_id": appt.doctor_id,
                        "doctorId": appt.doctor_id,
                        "doctor": doc.name_en if doc else "Unknown Doctor",
                        "doctor_name": doc.name_en if doc else "Unknown Doctor",
                        "doctor_name_ar": doc.name_ar if doc else "",
                        "doctorDept": (
                            spec.name_en
                            if spec
                            else (doc.title_en if doc else "General Medicine")
                        ),
                        "doctor_dept": (
                            spec.name_en
                            if spec
                            else (doc.title_en if doc else "General Medicine")
                        ),
                        "appointment_date": appt.appointment_date.isoformat(),
                        "date": appt.appointment_date.isoformat(),
                        "start_time": start_str,
                        "end_time": end_str,
                        "time": f"{start_str} - {end_str}",
                        "timeShort": time_short,
                        "status": status_formatted,
                        "type": "Consultation",
                        "visit_reason": appt.visit_reason or "Consultation",
                        "notes": appt.visit_reason or "General consultation",
                        "cancellation_reason": appt.cancellation_reason,
                        "created_at": (
                            appt.created_at.isoformat() if appt.created_at else None
                        ),
                        "updated_at": (
                            appt.updated_at.isoformat() if appt.updated_at else None
                        ),
                    }
                )
            return {"total": len(results), "appointments": results}

    @app.post("/api/v1/appointments", status_code=201, tags=["Appointments"])
    async def create_appointment(payload: dict[str, Any]) -> dict[str, Any]:
        from clinic_backend.models import Doctor, Specialty
        from clinic_backend.scheduling_models import Appointment, AppointmentHistory

        async with sessions() as session:
            # 1. Resolve Patient
            patient = None
            raw_patient_id = payload.get("patient_id")
            if raw_patient_id:
                if str(raw_patient_id).isdigit():
                    patient = await session.scalar(
                        select(Patient).where(
                            or_(
                                Patient.id == int(raw_patient_id),
                                Patient.customer_number == str(raw_patient_id),
                            )
                        )
                    )
                else:
                    patient = await session.scalar(
                        select(Patient).where(
                            Patient.customer_number == str(raw_patient_id)
                        )
                    )

            if not patient and (payload.get("phone") or payload.get("patientPhone")):
                clean_phone = str(
                    payload.get("phone") or payload.get("patientPhone")
                ).strip()
                if not clean_phone.startswith("+"):
                    clean_phone = f"+{clean_phone}"
                patient = await session.scalar(
                    select(Patient).where(Patient.phone == clean_phone)
                )

            if not patient:
                p_name = str(
                    payload.get("patient_name")
                    or payload.get("patientName")
                    or payload.get("name")
                    or "Walk-in Patient"
                ).strip()
                p_phone = str(
                    payload.get("phone")
                    or payload.get("patient_phone")
                    or payload.get("patientPhone")
                    or "+201000000000"
                ).strip()
                if not p_phone.startswith("+"):
                    p_phone = f"+{p_phone}"

                import random

                cust_num = f"{random.randint(100000, 999999)}"
                patient = Patient(
                    full_name=p_name,
                    phone=p_phone,
                    customer_number=cust_num,
                    preferred_language="ar",
                    gender="male",
                )
                session.add(patient)
                await session.flush()

            # 2. Resolve Doctor
            raw_doc_id = payload.get("doctor_id") or payload.get("doctorId")
            doctor = None
            if raw_doc_id:
                doctor = await session.scalar(
                    select(Doctor).where(Doctor.id == int(raw_doc_id))
                )
            elif payload.get("doctor"):
                doc_name = str(payload["doctor"]).replace("Dr. ", "").strip().lower()
                doctor = await session.scalar(
                    select(Doctor).where(
                        func.lower(Doctor.name_en).like(f"%{doc_name}%")
                    )
                )

            if not doctor:
                doctor = await session.scalar(select(Doctor).order_by(Doctor.id.asc()))
            if not doctor:
                raise APIError(
                    404,
                    "DOCTOR_NOT_FOUND",
                    "No available doctors found in clinic catalog.",
                )

            # 3. Resolve Date & Time
            raw_date = payload.get("appointment_date") or payload.get("date")
            if not raw_date:
                raise APIError(400, "MISSING_DATE", "Appointment date is required.")
            try:
                appt_date = dt_date.fromisoformat(str(raw_date)[:10])
            except Exception:
                raise APIError(
                    400,
                    "INVALID_DATE",
                    "Invalid appointment date format. Use YYYY-MM-DD.",
                )

            if appt_date.isoweekday() == 5:
                raise APIError(400, "CLINIC_CLOSED", "The clinic is closed on Fridays.")

            raw_time = str(
                payload.get("start_time")
                or payload.get("time")
                or payload.get("timeShort")
                or "09:00"
            ).strip()
            if " - " in raw_time:
                raw_time = raw_time.split(" - ")[0].strip()

            if " " in raw_time:
                parts = raw_time.split(" ")
                t_parts = parts[0].split(":")
                hrs = int(t_parts[0])
                mins = int(t_parts[1]) if len(t_parts) > 1 else 0
                if parts[1].upper() == "PM" and hrs < 12:
                    hrs += 12
                elif parts[1].upper() == "AM" and hrs == 12:
                    hrs = 0
                start_obj = dt_time(hrs, mins)
            else:
                t_parts = raw_time.split(":")
                hrs = int(t_parts[0])
                mins = int(t_parts[1]) if len(t_parts) > 1 else 0
                start_obj = dt_time(hrs, mins)

            if start_obj.minute not in (0, 30):
                start_obj = dt_time(start_obj.hour, 30 if start_obj.minute > 15 else 0)

            if start_obj < dt_time(7, 0) or start_obj > dt_time(21, 30):
                raise APIError(
                    400, "INVALID_TIME", "Appointments must be between 07:00 and 21:30."
                )

            end_dt = datetime.combine(appt_date, start_obj) + timedelta(minutes=30)
            end_obj = end_dt.time()

            # 4. Check slot conflict
            conflict = await session.scalar(
                select(Appointment).where(
                    Appointment.doctor_id == doctor.id,
                    Appointment.appointment_date == appt_date,
                    Appointment.start_time == start_obj,
                    Appointment.status == "scheduled",
                )
            )
            if conflict:
                raise APIError(
                    409,
                    "SLOT_OCCUPIED",
                    f"Dr. {doctor.name_en} already has a scheduled appointment "
                    f"at {start_obj.strftime('%H:%M')} on {appt_date}.",
                )

            # 5. Insert Appointment
            reason = str(
                payload.get("visit_reason")
                or payload.get("notes")
                or payload.get("type")
                or "General Consultation"
            ).strip()
            appt = Appointment(
                patient_id=patient.id,
                doctor_id=doctor.id,
                appointment_date=appt_date,
                start_time=start_obj,
                end_time=end_obj,
                status="scheduled",
                visit_reason=reason[:300],
            )
            session.add(appt)
            await session.flush()

            # 6. Insert AppointmentHistory
            history = AppointmentHistory(
                appointment_id=appt.id,
                event="created",
                new_date=appt_date,
                new_start_time=start_obj,
                actor="clinic_staff",
            )
            session.add(history)
            await session.commit()
            await session.refresh(appt)

            spec = await session.scalar(
                select(Specialty).where(Specialty.id == doctor.specialty_id)
            )

            start_str = appt.start_time.strftime("%H:%M")
            end_str = appt.end_time.strftime("%H:%M")
            start_dt = datetime.combine(appt.appointment_date, appt.start_time)
            time_short = start_dt.strftime("%I:%M %p").lstrip("0")
            if time_short.startswith(":"):
                time_short = "0" + time_short

            data = {
                "id": appt.id,
                "patient_id": patient.id,
                "patientName": patient.full_name,
                "patient_name": patient.full_name,
                "patientPhone": patient.phone,
                "patient_phone": patient.phone,
                "patientCode": patient.customer_number,
                "patient_code": patient.customer_number,
                "patientAvatar": (
                    patient.full_name[0].upper() if patient.full_name else "P"
                ),
                "patientAvatarBg": "#EFF6FF",
                "patientAvatarColor": "#2563EB",
                "doctor_id": doctor.id,
                "doctorId": doctor.id,
                "doctor": doctor.name_en,
                "doctor_name": doctor.name_en,
                "doctorDept": (
                    spec.name_en if spec else (doctor.title_en or "General Medicine")
                ),
                "doctor_dept": (
                    spec.name_en if spec else (doctor.title_en or "General Medicine")
                ),
                "appointment_date": appt.appointment_date.isoformat(),
                "date": appt.appointment_date.isoformat(),
                "start_time": start_str,
                "end_time": end_str,
                "time": f"{start_str} - {end_str}",
                "timeShort": time_short,
                "status": "Confirmed",
                "visit_reason": appt.visit_reason,
                "notes": appt.visit_reason,
                "type": payload.get("type") or "Consultation",
            }

            # 7. WebSocket Live Broadcast across ALL operators
            await ws_manager.broadcast("APPOINTMENT_BOOKED", data)

            return data

    @app.patch("/api/v1/appointments/{appointment_id}/cancel", tags=["Appointments"])
    async def cancel_appointment(
        appointment_id: int, payload: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        from clinic_backend.scheduling_models import Appointment, AppointmentHistory

        async with sessions() as session:
            appt = await session.scalar(
                select(Appointment).where(Appointment.id == appointment_id)
            )
            if not appt:
                raise APIError(404, "APPOINTMENT_NOT_FOUND", "Appointment not found.")
            if appt.status == "cancelled":
                raise APIError(
                    400, "ALREADY_CANCELLED", "Appointment is already cancelled."
                )

            reason = str(
                (payload or {}).get("reason") or "Cancelled by operator"
            ).strip()
            appt.status = "cancelled"
            appt.cancellation_reason = reason[:300]
            appt.cancelled_at = datetime.now(UTC)
            appt.cancelled_by = "clinic_staff"
            appt.updated_at = datetime.now(UTC)

            history = AppointmentHistory(
                appointment_id=appt.id,
                event="cancelled",
                previous_date=appt.appointment_date,
                previous_start_time=appt.start_time,
                actor="clinic_staff",
            )
            session.add(history)
            await session.commit()

            await ws_manager.broadcast(
                "APPOINTMENT_CANCELLED",
                {
                    "id": appt.id,
                    "patient_id": appt.patient_id,
                    "doctor_id": appt.doctor_id,
                    "status": "Cancelled",
                    "cancellation_reason": reason,
                },
            )
            return {"status": "cancelled", "id": appt.id}

    @app.patch(
        "/api/v1/appointments/{appointment_id}/reschedule", tags=["Appointments"]
    )
    async def reschedule_appointment(
        appointment_id: int, payload: dict[str, Any]
    ) -> dict[str, Any]:
        from clinic_backend.scheduling_models import Appointment, AppointmentHistory

        async with sessions() as session:
            appt = await session.scalar(
                select(Appointment).where(Appointment.id == appointment_id)
            )
            if not appt:
                raise APIError(404, "APPOINTMENT_NOT_FOUND", "Appointment not found.")

            raw_date = payload.get("appointment_date") or payload.get("date")
            raw_time = payload.get("start_time") or payload.get("time")
            if not raw_date or not raw_time:
                raise APIError(
                    400, "INVALID_INPUT", "Must provide new appointment date and time."
                )

            new_date = dt_date.fromisoformat(str(raw_date)[:10])
            if new_date.isoweekday() == 5:
                raise APIError(400, "CLINIC_CLOSED", "The clinic is closed on Fridays.")

            clean_time = str(raw_time).strip()
            if " - " in clean_time:
                clean_time = clean_time.split(" - ")[0].strip()

            if " " in clean_time:
                parts = clean_time.split(" ")
                t_parts = parts[0].split(":")
                hrs = int(t_parts[0])
                mins = int(t_parts[1]) if len(t_parts) > 1 else 0
                if parts[1].upper() == "PM" and hrs < 12:
                    hrs += 12
                elif parts[1].upper() == "AM" and hrs == 12:
                    hrs = 0
                new_start = dt_time(hrs, mins)
            else:
                t_parts = clean_time.split(":")
                new_start = dt_time(
                    int(t_parts[0]), int(t_parts[1]) if len(t_parts) > 1 else 0
                )

            if new_start.minute not in (0, 30):
                new_start = dt_time(new_start.hour, 30 if new_start.minute > 15 else 0)

            new_end = (
                datetime.combine(new_date, new_start) + timedelta(minutes=30)
            ).time()

            conflict = await session.scalar(
                select(Appointment).where(
                    Appointment.doctor_id == appt.doctor_id,
                    Appointment.appointment_date == new_date,
                    Appointment.start_time == new_start,
                    Appointment.status == "scheduled",
                    Appointment.id != appt.id,
                )
            )
            if conflict:
                raise APIError(
                    409, "SLOT_OCCUPIED", "Target time slot is already booked."
                )

            prev_date = appt.appointment_date
            prev_time = appt.start_time

            appt.appointment_date = new_date
            appt.start_time = new_start
            appt.end_time = new_end
            appt.status = "scheduled"
            appt.updated_at = datetime.now(UTC)

            history = AppointmentHistory(
                appointment_id=appt.id,
                event="time_changed",
                previous_date=prev_date,
                previous_start_time=prev_time,
                new_date=new_date,
                new_start_time=new_start,
                actor="clinic_staff",
            )
            session.add(history)
            await session.commit()

            start_str = appt.start_time.strftime("%H:%M")
            start_dt = datetime.combine(appt.appointment_date, appt.start_time)
            time_short = start_dt.strftime("%I:%M %p").lstrip("0")
            if time_short.startswith(":"):
                time_short = "0" + time_short

            await ws_manager.broadcast(
                "APPOINTMENT_BOOKED",
                {
                    "id": appt.id,
                    "patient_id": appt.patient_id,
                    "doctor_id": appt.doctor_id,
                    "appointment_date": appt.appointment_date.isoformat(),
                    "date": appt.appointment_date.isoformat(),
                    "start_time": start_str,
                    "timeShort": time_short,
                    "status": "Confirmed",
                },
            )
            return {"status": "rescheduled", "id": appt.id}

    app.include_router(
        availability_router(sessions, settings, clock or (lambda: datetime.now(UTC)))
    )
    app.include_router(conversation_router(sessions, settings))
    if settings.identity_enabled:
        from clinic_backend.booking_routes import booking_router
        from clinic_backend.identity_routes import identity_router

        app.include_router(
            booking_router(sessions, settings, clock or (lambda: datetime.now(UTC)))
        )

        identity = identity_router(sessions, settings, mailer)
        if settings.identity_provider == "supabase":
            from clinic_backend.supabase_routes import supabase_router

            identity.routes = [
                route
                for route in identity.routes
                if getattr(route, "path", "")
                in {
                    "/api/v1/patients/me",
                    "/api/v1/patients/me/logout",
                    "/api/v1/conversations/current/verification",
                }
            ]
            app.include_router(
                supabase_router(sessions, settings, auth_client or AuthClient(settings))
            )
        else:

            @app.get("/api/v1/auth/config", dependencies=[Depends(no_query)])
            async def legacy_auth_config() -> dict[str, object]:
                return {"provider": "clinic", "otp_length": 6}

        app.include_router(identity)
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
                        "base-uri 'none'; form-action 'self'; "
                        + (
                            "connect-src 'self' " + settings.supabase_url + ";"
                            if settings.identity_provider == "supabase"
                            else "connect-src 'self';"
                        )
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
