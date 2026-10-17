"""Same-origin patient authentication. Provider credentials stay in HttpOnly cookies."""

import base64
import hashlib
import re
import secrets
from datetime import UTC, datetime, timedelta
from urllib.parse import quote, urlencode, urlsplit

from clinic_schemas import portal as dto
from clinic_schemas.identity import PatientProfile, Registration
from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from starlette.responses import JSONResponse, Response

from clinic_backend.conversations import creation_retry
from clinic_backend.errors import APIError, error_response
from clinic_backend.identity import Identity, revoke, socket_ip
from clinic_backend.identity_models import Patient, PatientSession
from clinic_backend.models import ConversationSession, Doctor, Specialty
from clinic_backend.scheduling_models import Appointment, AppointmentHistory
from clinic_backend.settings import Settings
from clinic_backend.supabase_auth import AuthClient, VerifiedAuthUser
from clinic_backend.supabase_identity import SupabaseIdentity, active_auth_session

PREFIX = "/api/v1/portal"
GOOGLE = "clinic_portal_google"
ACCESS, REFRESH, CONVERSATION, RECOVERY = (
    "clinic_portal_access",
    "clinic_portal_refresh",
    "clinic_portal_conversation",
    "clinic_portal_recovery",
)

LOOPBACK_ORIGIN_REGEX = re.compile(
    r"^http://(localhost|127\.0\.0\.1)(:\d+)?/?$", re.IGNORECASE
)


def is_allowed_portal_origin(origin_val: str, portal_origin: str) -> bool:
    cleaned = (origin_val or "").strip().rstrip("/")
    if cleaned and cleaned.lower() == (portal_origin or "").strip().rstrip("/").lower():
        return True
    return bool(LOOPBACK_ORIGIN_REGEX.fullmatch(cleaned))


def is_loopback_http(request: Request | None) -> bool:
    if request is None:
        return False
    # Use the actual request scheme/host (trusted proxy handling happens in Uvicorn).
    # A loopback Origin header on a public HTTPS request must not downgrade cookies.
    return request.url.scheme == "http" and request.url.hostname in {
        "localhost",
        "127.0.0.1",
    }


def portal_router(
    sessions: async_sessionmaker[AsyncSession], settings: Settings, auth: AuthClient
) -> APIRouter:
    def is_cookie_secure(request: Request | None) -> bool:
        if is_loopback_http(request):
            return False
        return settings.portal_cookie_secure

    async def origin(request: Request) -> None:
        if request.query_params:
            raise APIError(400, "VALIDATION_FAILED", "Unexpected query parameters.")
        if request.method != "GET" and not is_allowed_portal_origin(
            request.headers.get("Origin", ""), settings.portal_origin
        ):
            raise APIError(
                403, "ACTION_NOT_ALLOWED", "Use the clinic portal to continue."
            )
        if "X-Service-Token" in request.headers:
            raise APIError(
                403, "ACTION_NOT_ALLOWED", "Browser authentication required."
            )

    router = APIRouter(
        prefix=PREFIX, tags=["Patient portal"], dependencies=[Depends(origin)]
    )

    def cookie(
        response: Response,
        name: str,
        value: str,
        age: int = 3600,
        request: Request | None = None,
    ) -> None:
        response.set_cookie(
            name,
            value,
            max_age=age,
            httponly=True,
            secure=is_cookie_secure(request),
            samesite="strict",
            path=PREFIX,
        )
        response.headers["Cache-Control"] = "no-store"

    def clear(response: Response, request: Request | None = None) -> None:
        sec = is_cookie_secure(request)
        for name in [ACCESS, REFRESH, CONVERSATION, RECOVERY, GOOGLE]:
            response.delete_cookie(
                name,
                path=PREFIX,
                httponly=True,
                secure=sec,
                samesite="strict",
            )
        response.headers["Cache-Control"] = "no-store"

    async def limit(request: Request, operation: str, identifier: str = "") -> None:
        async with sessions() as session, session.begin():
            identity = Identity(session, settings)
            key = identity.digest(
                identifier.lower()
                or (request.client.host if request.client else "unknown")
            ).hex()
            error = await identity.limits(
                [
                    (
                        "portal_" + operation + ":ip",
                        socket_ip(request.client.host if request.client else None)
                        or "unknown",
                        20,
                        900,
                        0,
                    ),
                    ("portal_" + operation + ":identity", key, 5, 900, 0),
                ]
            )
        if error:
            raise error

    async def conversation(request: Request, response: Response) -> str:
        token = request.cookies.get(CONVERSATION, "")
        async with sessions() as session, session.begin():
            identity = Identity(session, settings)
            peer = socket_ip(request.client.host if request.client else None)
            if token:
                existing = await identity.conversation(token)
                if not isinstance(existing, APIError) and str(
                    existing.client_ip or "unknown"
                ) == str(peer or "unknown"):
                    return token
            # Preserve the old audit record; a changed source starts a fresh
            # conversation so profile quotas use the current trusted peer.
            retry = await creation_retry(session, peer or "unknown", datetime.now(UTC))
            if retry:
                raise APIError(
                    429, "RATE_LIMITED", "Try again later.", {"retry_after": retry}
                )
            token = secrets.token_urlsafe(32)
            session.add(
                ConversationSession(
                    token_hash=hashlib.sha256(token.encode()).digest(),
                    channel="text",
                    status="active",
                    client_ip=peer,
                )
            )
        cookie(response, CONVERSATION, token, request=request)
        return token

    async def provider_session(
        request: Request, response: Response
    ) -> tuple[VerifiedAuthUser, str]:
        access = request.cookies.get(ACCESS, "")
        if not access:
            raise APIError(401, "VERIFICATION_REQUIRED", "Sign in again.")
        try:
            return await auth.verify_access_token(access), access
        except APIError as error:
            refresh = request.cookies.get(REFRESH, "")
            if error.status != 401 or not refresh:
                raise
            data = await auth.request(
                "token?grant_type=refresh_token", body={"refresh_token": refresh}
            )
            access = str(data.get("access_token", ""))
            user = await auth.verify_access_token(access)
            save_provider(response, data, request=request)
            return user, access

    def save_provider(
        response: Response,
        data: dict[str, object],
        request: Request | None = None,
    ) -> None:
        access, refresh = data.get("access_token"), data.get("refresh_token")
        if (
            not isinstance(access, str)
            or not access
            or len(access) > 16384
            or not isinstance(refresh, str)
            or not refresh
            or len(refresh) > 4096
        ):
            raise APIError(503, "SERVICE_UNAVAILABLE", "Authentication unavailable.")
        cookie(response, ACCESS, access, request=request)
        cookie(response, REFRESH, refresh, request=request)

    async def bind(
        request: Request,
        response: Response,
        data: dict[str, object],
        form: Registration | None,
    ) -> PatientProfile:
        access = data.get("access_token")
        if not isinstance(access, str):
            raise APIError(
                401, "VERIFICATION_REQUIRED", "Confirm your email before signing in."
            )
        user = await auth.verify_access_token(access)
        token = await conversation(request, response)
        async with sessions() as session, session.begin():
            identity = SupabaseIdentity(session, settings)
            row = await identity.conversation(token)
            if isinstance(row, APIError):
                raise row
            profile = await identity.complete(row, user, form)
        save_provider(response, data, request=request)
        return profile

    def callback_url(request: Request, return_path: str | None = None) -> str:
        # POST Origin has already passed the configured/loopback allowlist.
        base = request.headers.get("Origin", "").strip().rstrip(
            "/"
        ) or settings.portal_origin.rstrip("/")
        if return_path is None:
            return_path = (
                "/auth.html"
                if urlsplit(base).port in {5500, 5501, 3000, 5173}
                else "/portal/auth.html"
            )
        return base + return_path

    def clear_google(response: Response, request: Request) -> None:
        response.delete_cookie(
            GOOGLE,
            path=PREFIX,
            httponly=True,
            secure=is_cookie_secure(request),
            samesite="lax",
        )
        response.headers["Cache-Control"] = "no-store"

    @router.post("/google")
    async def google_start(
        body: dto.GoogleStart, request: Request, response: Response
    ) -> dict[str, str]:
        if not settings.portal_google_enabled:
            raise APIError(503, "SERVICE_UNAVAILABLE", "Google sign-in unavailable.")
        await limit(request, "google")
        verifier, state = secrets.token_urlsafe(48), secrets.token_urlsafe(32)
        challenge = (
            base64.urlsafe_b64encode(hashlib.sha256(verifier.encode("ascii")).digest())
            .decode("ascii")
            .rstrip("=")
        )
        # Only this temporary cookie is Lax: it must survive the Google redirect.
        # Provider access/refresh cookies retain SameSite=Strict.
        response.set_cookie(
            GOOGLE,
            verifier + "." + state,
            max_age=600,
            httponly=True,
            secure=is_cookie_secure(request),
            samesite="lax",
            path=PREFIX,
        )
        response.headers["Cache-Control"] = "no-store"
        redirect = (
            callback_url(request, body.return_path)
            + "?"
            + urlencode({"oauth_state": state})
        )
        return {
            "url": settings.supabase_url.rstrip("/")
            + "/auth/v1/authorize?"
            + urlencode(
                {
                    "provider": "google",
                    "redirect_to": redirect,
                    "code_challenge": challenge,
                    "code_challenge_method": "s256",
                }
            )
        }

    @router.post("/google/exchange", response_model=PatientProfile)
    async def google_exchange(
        body: dto.GoogleExchange,
        request: Request,
        response: Response,
    ) -> PatientProfile | Response:
        if not settings.portal_google_enabled:
            raise APIError(503, "SERVICE_UNAVAILABLE", "Google sign-in unavailable.")
        await limit(request, "google_exchange")
        try:
            value = request.cookies.get(GOOGLE, "")
            parts = value.split(".")
            if (
                len(parts) != 2
                or not re.fullmatch(r"[A-Za-z0-9_-]{64}", parts[0])
                or not re.fullmatch(r"[A-Za-z0-9_-]{43}", parts[1])
                or not secrets.compare_digest(parts[1], body.state)
            ):
                raise APIError(
                    401, "VERIFICATION_REQUIRED", "Start Google sign-in again."
                )
            data = await auth.request(
                "token?grant_type=pkce",
                body={
                    "auth_code": body.code.get_secret_value(),
                    "code_verifier": parts[0],
                },
            )
            save_provider(response, data, request=request)
            try:
                result = await bind(request, response, data, None)
            except APIError as error:
                if error.code != "REGISTRATION_REQUIRED":
                    raise
                user = await auth.verify_access_token(str(data["access_token"]))
                failure = error_response(
                    request,
                    error.status,
                    error.code,
                    error.message,
                    {"email_verified": True, "email": user.email},
                )
                for header in response.raw_headers:
                    if header[0].lower() == b"set-cookie":
                        failure.raw_headers.append(header)
                clear_google(failure, request)
                return failure
            clear_google(response, request)
            return result
        except APIError as error:
            failure = error_response(
                request, error.status, error.code, error.message, error.details
            )
            clear_google(failure, request)
            return failure

    @router.post("/signup", status_code=202, response_model=dto.Delivery)
    async def signup(
        body: dto.Signup, request: Request, response: Response
    ) -> dto.Delivery:
        await limit(request, "signup", body.email)
        async with sessions() as session:
            if await session.scalar(
                select(Patient.id).where(Patient.phone == body.phone)
            ):
                raise APIError(
                    409,
                    "PHONE_ALREADY_REGISTERED",
                    "This phone number is already registered.",
                )
            if await session.scalar(
                select(Patient.id).where(func.lower(Patient.email) == body.email)
            ):
                raise APIError(
                    409,
                    "EMAIL_ALREADY_REGISTERED",
                    "This email is already registered. Sign in or reset your password.",
                )
        await auth.request(
            "signup",
            body={"email": body.email, "password": body.password.get_secret_value()},
        )
        await conversation(request, response)
        response.headers["Cache-Control"] = "no-store"
        return dto.Delivery()

    @router.post("/verify", response_model=PatientProfile)
    async def verify(
        body: dto.Verify, request: Request, response: Response
    ) -> PatientProfile | Response:
        has_provider_cookies = bool(
            request.cookies.get(ACCESS) and request.cookies.get(REFRESH)
        )
        # Already verified profile completion has its own bounded retry budget.
        # Invalid cookies must still consume the OTP verification budget below.
        await limit(
            request, "profile" if has_provider_cookies else "verify", body.email
        )
        if body.email != body.registration.email:
            raise APIError(400, "VALIDATION_FAILED", "Registration email must match.")
        code = body.code.get_secret_value()
        if (
            len(code) != settings.supabase_otp_length
            or not code.isascii()
            or not code.isdigit()
        ):
            raise APIError(400, "INVALID_CODE", "Enter the verification code.")
        data: dict[str, object] | None = None
        if request.cookies.get(ACCESS) and request.cookies.get(REFRESH):
            try:
                existing = await auth.verify_access_token(request.cookies[ACCESS])
                if existing.email == body.email:
                    data = {
                        "access_token": request.cookies[ACCESS],
                        "refresh_token": request.cookies[REFRESH],
                    }
            except APIError as error:
                if error.status != 401:
                    raise
        if data is None:
            if has_provider_cookies:
                await limit(request, "verify", body.email)
            data = await auth.request(
                "verify", body={"email": body.email, "token": code, "type": "signup"}
            )
        save_provider(response, data, request=request)
        try:
            return await bind(request, response, data, body.registration)
        except APIError as error:
            failure = error_response(
                request,
                error.status,
                error.code,
                error.message,
                {**(error.details or {}), "email_verified": True},
            )
            if error.status == 429 and error.details:
                failure.headers["Retry-After"] = str(
                    error.details.get("retry_after", 60)
                )
            failure.headers["Cache-Control"] = "no-store"
            for header in response.raw_headers:
                if header[0].lower() == b"set-cookie":
                    failure.raw_headers.append(header)
            return failure

    @router.post("/resend", status_code=202, response_model=dto.Delivery)
    async def resend(
        body: dto.Email, request: Request, response: Response
    ) -> dto.Delivery:
        await limit(request, "resend", body.email)
        await auth.request("resend", body={"email": body.email, "type": "signup"})
        response.headers["Cache-Control"] = "no-store"
        return dto.Delivery()

    @router.post("/login", response_model=PatientProfile)
    async def login(
        body: dto.Login, request: Request, response: Response
    ) -> PatientProfile | Response:
        identifier = body.identifier.strip().lower()
        if "@" not in identifier:
            try:
                identifier = dto.normalize_phone(identifier)
            except ValueError:
                identifier = "invalid"
        await limit(request, "login", identifier)
        if "@" in identifier:
            email = identifier
        else:
            async with sessions() as session:
                found_email = await session.scalar(
                    select(Patient.email).where(
                        Patient.phone == identifier,
                        Patient.supabase_user_id.is_not(None),
                    )
                )
            email = found_email or ""
            if not email:
                # Use the same grant and generic failure for unknown phone numbers.
                email = f"unknown-{secrets.token_hex(16)}@example.invalid"
        data = await auth.request(
            "token?grant_type=password",
            body={"email": email, "password": body.password.get_secret_value()},
        )
        save_provider(response, data, request=request)
        try:
            return await bind(request, response, data, None)
        except APIError as error:
            if error.code != "REGISTRATION_REQUIRED":
                raise
            user = await auth.verify_access_token(str(data["access_token"]))
            failure = error_response(
                request,
                error.status,
                error.code,
                error.message,
                {"email_verified": True, "email": user.email},
            )
            failure.headers["Cache-Control"] = "no-store"
            for header in response.raw_headers:
                if header[0].lower() == b"set-cookie":
                    failure.raw_headers.append(header)
            return failure

    @router.get("/session", response_model=PatientProfile)
    async def profile(request: Request, response: Response) -> PatientProfile:
        user, _ = await provider_session(request, response)
        async with sessions() as session, session.begin():
            identity = Identity(session, settings)
            row = await identity.conversation(request.cookies.get(CONVERSATION, ""))
            if isinstance(row, APIError):
                raise row
            binding, _ = await identity.live_session(row, refresh=True)
            if binding is None or binding.supabase_session_id != user.session_id:
                raise APIError(401, "SESSION_EXPIRED", "Sign in again.")
            patient = await session.get(Patient, binding.patient_id)
            if patient is None or patient.supabase_user_id != user.user_id:
                raise APIError(401, "VERIFICATION_REQUIRED", "Sign in again.")
            result = PatientProfile(
                customer_number=patient.customer_number,
                first_name=patient.full_name.split()[0],
                preferred_language=patient.preferred_language,
                full_name=patient.full_name,
                email=patient.email,
                phone=patient.phone,
                date_of_birth=patient.date_of_birth,
                gender=patient.gender,
                address=patient.address,
            )
        response.headers["Cache-Control"] = "no-store"
        return result

    @router.get("/doctors")
    async def list_portal_doctors() -> Response:
        async with sessions() as session:
            stmt = (
                select(Doctor, Specialty)
                .join(Specialty, Doctor.specialty_id == Specialty.id)
                .where(Doctor.is_active.is_(True))
                .order_by(Doctor.id)
            )
            res = await session.execute(stmt)
            docs = []
            for d, s in res:
                docs.append({
                    "id": d.id,
                    "name_en": d.name_en,
                    "name_ar": d.name_ar,
                    "full_name_en": d.name_en,
                    "full_name_ar": d.name_ar,
                    "title_en": d.title_en,
                    "title_ar": d.title_ar,
                    "specialty_id": s.id,
                    "specialty_name_en": s.name_en,
                    "specialty_name_ar": s.name_ar,
                    "specialty": {
                        "id": s.id,
                        "name_en": s.name_en,
                        "name_ar": s.name_ar,
                    },
                    "shift_start": str(d.shift_start)[:5],
                    "shift_end": str(d.shift_end)[:5],
                    "consultation_fee": float(d.consultation_fee),
                })
        json_resp = JSONResponse({"total": len(docs), "doctors": docs})
        json_resp.headers["Cache-Control"] = "no-store"
        return json_resp

    @router.get("/specialties")
    async def list_portal_specialties() -> Response:
        async with sessions() as session:
            res = await session.scalars(select(Specialty).order_by(Specialty.id))
            specs = [
                {"id": s.id, "name_en": s.name_en, "name_ar": s.name_ar}
                for s in res
            ]
        json_resp = JSONResponse({"total": len(specs), "specialties": specs})
        json_resp.headers["Cache-Control"] = "no-store"
        return json_resp

    @router.get("/appointments")
    async def patient_appointments(request: Request, response: Response) -> Response:
        user, _ = await provider_session(request, response)
        async with sessions() as session, session.begin():
            identity = Identity(session, settings)
            row = await identity.conversation(request.cookies.get(CONVERSATION, ""))
            if isinstance(row, APIError):
                raise row
            binding, _ = await identity.live_session(row, refresh=True)
            if binding is None or binding.supabase_session_id != user.session_id:
                raise APIError(401, "SESSION_EXPIRED", "Sign in again.")

            stmt = (
                select(
                    Appointment.id,
                    Appointment.appointment_date,
                    Appointment.start_time,
                    Appointment.end_time,
                    Appointment.status,
                    Appointment.visit_reason,
                    Doctor.id.label("doctor_id"),
                    Doctor.name_en.label("doctor_name"),
                    Doctor.name_ar.label("doctor_name_ar"),
                    Specialty.name_en.label("specialty_name"),
                    Specialty.name_ar.label("specialty_name_ar"),
                    Specialty.id.label("specialty_id"),
                )
                .join(Doctor, Appointment.doctor_id == Doctor.id)
                .join(Specialty, Doctor.specialty_id == Specialty.id)
                .where(Appointment.patient_id == binding.patient_id)
                .order_by(Appointment.appointment_date.desc(), Appointment.start_time.desc())
            )
            res = await session.execute(stmt)
            appointments = []
            for item in res.mappings():
                t_str = str(item["start_time"])[:5]
                try:
                    dt = datetime.strptime(t_str, "%H:%M")
                    t_12 = dt.strftime("%I:%M %p")
                except Exception:
                    t_12 = t_str
                appointments.append({
                    "id": item["id"],
                    "appointment_date": str(item["appointment_date"]),
                    "start_time": str(item["start_time"]),
                    "time_short": t_12,
                    "doctor_name": item["doctor_name"],
                    "doctor_name_ar": item["doctor_name_ar"],
                    "doctor_id": item["doctor_id"],
                    "specialty_id": item["specialty_id"],
                    "specialty_name": item["specialty_name"],
                    "specialty_name_ar": item["specialty_name_ar"],
                    "branch_name": "Main Branch - Heliopolis",
                    "branch_name_ar": "الفرع الرئيسي - مصر الجديدة",
                    "status": item["status"],
                    "visit_reason": item["visit_reason"],
                    "avatar": "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=120&h=120&fit=crop&crop=faces",
                })
        json_resp = JSONResponse({"total": len(appointments), "appointments": appointments})
        json_resp.headers["Cache-Control"] = "no-store"
        return json_resp

    @router.post("/appointments", status_code=201)
    async def book_patient_appointment(
        body: dict[str, object], request: Request, response: Response
    ) -> Response:
        user, _ = await provider_session(request, response)
        async with sessions() as session, session.begin():
            identity = Identity(session, settings)
            row = await identity.conversation(request.cookies.get(CONVERSATION, ""))
            if isinstance(row, APIError):
                raise row
            binding, _ = await identity.live_session(row, refresh=True)
            if binding is None or binding.supabase_session_id != user.session_id:
                raise APIError(401, "SESSION_EXPIRED", "Sign in again.")

            doctor_id = int(body.get("doctor_id") or body.get("doctorId") or 1)
            date_raw = str(body.get("appointment_date") or body.get("date") or "")[:10]
            appt_date = datetime.strptime(date_raw, "%Y-%m-%d").date()
            time_raw = str(body.get("start_time") or body.get("time") or "10:00")[:5]
            start_t = datetime.strptime(time_raw, "%H:%M").time()
            start_dt = datetime.combine(appt_date, start_t)
            end_t = (start_dt + timedelta(minutes=30)).time()
            visit_reason = str(body.get("visit_reason") or body.get("reason") or "Routine consultation via patient portal")

            new_appt = Appointment(
                patient_id=binding.patient_id,
                doctor_id=doctor_id,
                appointment_date=appt_date,
                start_time=start_t,
                end_time=end_t,
                status="scheduled",
                visit_reason=visit_reason,
            )
            session.add(new_appt)
            await session.flush()
            created_id = new_appt.id

            session.add(
                AppointmentHistory(
                    appointment_id=created_id,
                    changed_by="patient",
                    from_status=None,
                    to_status="scheduled",
                    reason=visit_reason,
                )
            )
            await session.flush()

        json_resp = JSONResponse(
            {"id": created_id, "status": "scheduled", "message": "Appointment booked successfully"},
            status_code=201,
        )
        json_resp.headers["Cache-Control"] = "no-store"
        return json_resp

    @router.patch("/appointments/{appointment_id}/cancel")
    async def cancel_patient_appointment(
        appointment_id: int, body: dict[str, object], request: Request, response: Response
    ) -> Response:
        user, _ = await provider_session(request, response)
        async with sessions() as session, session.begin():
            identity = Identity(session, settings)
            row = await identity.conversation(request.cookies.get(CONVERSATION, ""))
            if isinstance(row, APIError):
                raise row
            binding, _ = await identity.live_session(row, refresh=True)
            if binding is None or binding.supabase_session_id != user.session_id:
                raise APIError(401, "SESSION_EXPIRED", "Sign in again.")

            appt = await session.get(Appointment, appointment_id)
            if appt is None or appt.patient_id != binding.patient_id:
                raise APIError(404, "NOT_FOUND", "Appointment not found.")

            old_status = appt.status
            appt.status = "cancelled"
            appt.cancelled_at = datetime.now(UTC)
            appt.cancelled_by = "patient"
            appt.cancellation_reason = str(body.get("reason") or "Patient cancelled via portal")
            session.add(
                AppointmentHistory(
                    appointment_id=appointment_id,
                    changed_by="patient",
                    from_status=old_status,
                    to_status="cancelled",
                    reason=appt.cancellation_reason,
                )
            )
            await session.flush()

        json_resp = JSONResponse(
            {"id": appointment_id, "status": "cancelled", "message": "Appointment cancelled successfully"}
        )
        json_resp.headers["Cache-Control"] = "no-store"
        return json_resp

    @router.patch("/appointments/{appointment_id}/reschedule")
    async def reschedule_patient_appointment(
        appointment_id: int, body: dict[str, object], request: Request, response: Response
    ) -> Response:
        user, _ = await provider_session(request, response)
        async with sessions() as session, session.begin():
            identity = Identity(session, settings)
            row = await identity.conversation(request.cookies.get(CONVERSATION, ""))
            if isinstance(row, APIError):
                raise row
            binding, _ = await identity.live_session(row, refresh=True)
            if binding is None or binding.supabase_session_id != user.session_id:
                raise APIError(401, "SESSION_EXPIRED", "Sign in again.")

            appt = await session.get(Appointment, appointment_id)
            if appt is None or appt.patient_id != binding.patient_id:
                raise APIError(404, "NOT_FOUND", "Appointment not found.")

            new_date = datetime.strptime(str(body.get("new_date")), "%Y-%m-%d").date()
            new_time = datetime.strptime(str(body.get("new_start_time"))[:5], "%H:%M").time()
            start_dt = datetime.combine(new_date, new_time)
            end_t = (start_dt + timedelta(minutes=30)).time()

            old_status = appt.status
            appt.appointment_date = new_date
            appt.start_time = new_time
            appt.end_time = end_t
            appt.status = "scheduled"
            session.add(
                AppointmentHistory(
                    appointment_id=appointment_id,
                    changed_by="patient",
                    from_status=old_status,
                    to_status="scheduled",
                    reason=str(body.get("reason") or "Patient rescheduled via portal"),
                )
            )
            await session.flush()

        json_resp = JSONResponse(
            {"id": appointment_id, "status": "scheduled", "message": "Appointment rescheduled successfully"}
        )
        json_resp.headers["Cache-Control"] = "no-store"
        return json_resp

    @router.post("/change-password")
    async def change_password(
        body: dict[str, str], request: Request, response: Response
    ) -> Response:
        user, access = await provider_session(request, response)
        current_password = str(body.get("current_password") or "").strip()
        new_password = str(body.get("new_password") or "").strip()
        confirm_password = str(body.get("confirm_password") or new_password).strip()

        if not new_password or len(new_password) < 8:
            raise APIError(400, "INVALID_PASSWORD", "New password must be at least 8 characters.")
        if new_password != confirm_password:
            raise APIError(400, "PASSWORD_MISMATCH", "New password and confirmation do not match.")

        if current_password:
            try:
                await auth.request(
                    "token?grant_type=password",
                    body={"email": user.email, "password": current_password},
                )
            except APIError as exc:
                raise APIError(400, "INVALID_CURRENT_PASSWORD", "Current password is incorrect.") from exc

        try:
            await auth.request(
                "user",
                token=access,
                method="PUT",
                body={"password": new_password},
            )
        except APIError as exc:
            if exc.status == 503:
                raise APIError(503, "SERVICE_UNAVAILABLE", "Supabase authentication service unavailable.") from exc
            raise

        json_resp = JSONResponse(
            {"status": "success", "message": "Password updated successfully in Supabase."}
        )
        json_resp.headers["Cache-Control"] = "no-store"
        return json_resp

    @router.post("/logout", status_code=204)
    async def logout(request: Request) -> Response:
        response = Response(status_code=204)
        if request.cookies.get(ACCESS):
            try:
                _, access = await provider_session(request, response)
            except APIError as error:
                if error.status != 401:
                    raise
                access = ""
            try:
                if access:
                    await auth.request("logout?scope=local", token=access, body={})
            except APIError as error:
                if error.status != 401:
                    raise
        async with sessions() as session, session.begin():
            identity = Identity(session, settings)
            row = await identity.conversation(request.cookies.get(CONVERSATION, ""))
            if not isinstance(row, APIError):
                await revoke(session, row.id, "logout", datetime.now(UTC))
        clear(response, request=request)
        return response

    @router.post("/recover", status_code=202, response_model=dto.Delivery)
    async def recover(
        body: dto.RecoveryEmail, request: Request, response: Response
    ) -> dto.Delivery:
        await limit(request, "recover", body.email)
        redirect = callback_url(request, body.return_path)
        await auth.request(
            "recover?redirect_to=" + quote(redirect, safe=""),
            body={"email": body.email},
        )
        response.headers["Cache-Control"] = "no-store"
        return dto.Delivery()

    @router.post("/recovery-session", status_code=204)
    async def recovery_session(body: dto.RecoverySession, request: Request) -> Response:
        await limit(request, "recovery")
        token = body.access_token.get_secret_value()
        user = await auth.verify_access_token(token)
        async with sessions() as session:
            if not await active_auth_session(session, user.user_id, user.session_id):
                raise APIError(
                    401, "VERIFICATION_REQUIRED", "Request a new reset link."
                )
        response = Response(status_code=204)
        cookie(response, RECOVERY, token, 600, request=request)
        return response

    @router.post("/reset-password", status_code=204)
    async def reset(body: dto.Reset, request: Request) -> Response:
        await limit(request, "reset", body.email)
        token = request.cookies.get(RECOVERY, "")
        user = await auth.verify_access_token(token)
        async with sessions() as session:
            if not await active_auth_session(session, user.user_id, user.session_id):
                raise APIError(
                    401, "VERIFICATION_REQUIRED", "Request a new reset link."
                )
        if user.email != body.email:
            raise APIError(
                401,
                "VERIFICATION_REQUIRED",
                "Use the email associated with this reset link.",
            )
        await auth.request(
            "user",
            token=token,
            method="PUT",
            body={"password": body.password.get_secret_value()},
        )
        async with sessions() as session, session.begin():
            patient_id = await session.scalar(
                select(Patient.id).where(Patient.supabase_user_id == user.user_id)
            )
            if patient_id:
                await session.execute(
                    update(PatientSession)
                    .where(
                        PatientSession.patient_id == patient_id,
                        PatientSession.revoked_at.is_(None),
                    )
                    .values(revoked_at=datetime.now(UTC), revoke_reason="logout")
                )
        try:
            await auth.request("logout?scope=global", token=token, body={})
        except APIError as error:
            if error.status != 401:
                raise
        response = Response(status_code=204)
        clear(response, request=request)
        return response

    return router
