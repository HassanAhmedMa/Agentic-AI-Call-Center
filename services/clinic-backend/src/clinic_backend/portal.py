"""Same-origin patient authentication. Provider credentials stay in HttpOnly cookies."""

import hashlib
import secrets
from datetime import UTC, datetime
from urllib.parse import quote

from clinic_schemas import portal as dto
from clinic_schemas.identity import PatientProfile, Registration
from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from starlette.responses import Response

from clinic_backend.conversations import creation_retry
from clinic_backend.errors import APIError, error_response
from clinic_backend.identity import Identity, revoke, socket_ip
from clinic_backend.identity_models import Patient, PatientSession
from clinic_backend.models import ConversationSession
from clinic_backend.settings import Settings
from clinic_backend.supabase_auth import AuthClient, VerifiedAuthUser
from clinic_backend.supabase_identity import SupabaseIdentity, active_auth_session

PREFIX = "/api/v1/portal"
ACCESS, REFRESH, CONVERSATION, RECOVERY = (
    "clinic_portal_access",
    "clinic_portal_refresh",
    "clinic_portal_conversation",
    "clinic_portal_recovery",
)


def portal_router(
    sessions: async_sessionmaker[AsyncSession], settings: Settings, auth: AuthClient
) -> APIRouter:
    async def origin(request: Request) -> None:
        if request.query_params:
            raise APIError(400, "VALIDATION_FAILED", "Unexpected query parameters.")
        if request.method != "GET" and request.headers.get("Origin", "").rstrip(
            "/"
        ) != settings.portal_origin.rstrip("/"):
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

    def cookie(response: Response, name: str, value: str, age: int = 3600) -> None:
        response.set_cookie(
            name,
            value,
            max_age=age,
            httponly=True,
            secure=settings.portal_cookie_secure,
            samesite="strict",
            path=PREFIX,
        )
        response.headers["Cache-Control"] = "no-store"

    def clear(response: Response) -> None:
        for name in [ACCESS, REFRESH, CONVERSATION, RECOVERY]:
            response.delete_cookie(
                name,
                path=PREFIX,
                httponly=True,
                secure=settings.portal_cookie_secure,
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
        cookie(response, CONVERSATION, token)
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
            save_provider(response, data)
            return user, access

    def save_provider(response: Response, data: dict[str, object]) -> None:
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
        cookie(response, ACCESS, access)
        cookie(response, REFRESH, refresh)

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
        save_provider(response, data)
        return profile

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
        save_provider(response, data)
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
        save_provider(response, data)
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
            )
        response.headers["Cache-Control"] = "no-store"
        return result

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
        clear(response)
        return response

    @router.post("/recover", status_code=202, response_model=dto.Delivery)
    async def recover(
        body: dto.Email, request: Request, response: Response
    ) -> dto.Delivery:
        await limit(request, "recover", body.email)
        redirect = settings.portal_origin.rstrip("/") + "/portal/auth.html"
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
        cookie(response, RECOVERY, token, 600)
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
        clear(response)
        return response

    return router
