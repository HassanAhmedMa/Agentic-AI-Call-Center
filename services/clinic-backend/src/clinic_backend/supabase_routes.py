from datetime import UTC, datetime
from typing import Any

from clinic_schemas.identity import ChallengeRequest, PatientProfile, Registration
from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from starlette.responses import Response

from clinic_backend.conversations import require_service
from clinic_backend.errors import APIError, ErrorEnvelope
from clinic_backend.identity import Identity, revoke, valid_customer_number
from clinic_backend.identity_models import Patient, PatientSession
from clinic_backend.settings import Settings
from clinic_backend.supabase_auth import AuthClient
from clinic_backend.supabase_identity import SupabaseIdentity


def supabase_router(
    sessions: async_sessionmaker[AsyncSession], settings: Settings, auth: AuthClient
) -> APIRouter:
    router = APIRouter(prefix="/api/v1/auth", tags=["Supabase identity"])

    async def no_query(request: Request) -> None:
        if request.query_params:
            raise APIError(400, "VALIDATION_FAILED", "Unexpected query parameters.")

    async def browser(request: Request) -> None:
        await no_query(request)
        if "X-Service-Token" in request.headers:
            raise APIError(
                403, "ACTION_NOT_ALLOWED", "Browser authentication required."
            )

    def bearer(request: Request) -> str:
        value = request.headers.get("Authorization", "")
        if not value.startswith("Bearer "):
            raise APIError(401, "VERIFICATION_REQUIRED", "Authentication required.")
        return value[7:]

    errors: dict[int | str, dict[str, Any]] = {
        code: {"model": ErrorEnvelope} for code in [400, 401, 403, 409, 429, 503]
    }

    @router.get("/config", dependencies=[Depends(no_query)])
    async def config(response: Response) -> dict[str, object]:
        response.headers["Cache-Control"] = "no-store"
        return {
            "provider": "supabase",
            "url": settings.supabase_url,
            "public_key": (
                settings.supabase_public_key.get_secret_value()
                if settings.supabase_public_key
                else ""
            ),
            "otp_length": settings.supabase_otp_length,
            "otp_ttl_seconds": settings.supabase_otp_ttl_seconds,
        }

    async def complete(request: Request, form: Registration | None) -> PatientProfile:
        user = await auth.verify_access_token(bearer(request))
        async with sessions() as session, session.begin():
            store = SupabaseIdentity(session, settings)
            conversation = await store.conversation(
                request.headers.get("X-Conversation-Token", "")
            )
            if isinstance(conversation, APIError):
                raise conversation
            return await store.complete(conversation, user, form)

    @router.post(
        "/complete",
        response_model=PatientProfile,
        responses=errors,
        dependencies=[Depends(browser)],
    )
    async def register(
        request: Request, form: Registration, response: Response
    ) -> PatientProfile:
        response.headers["Cache-Control"] = "no-store"
        return await complete(request, form)

    @router.post(
        "/bind",
        response_model=PatientProfile,
        responses=errors,
        dependencies=[Depends(browser)],
    )
    async def bind(request: Request, response: Response) -> PatientProfile:
        response.headers["Cache-Control"] = "no-store"
        return await complete(request, None)

    @router.post(
        "/request-login",
        status_code=202,
        responses=errors,
        dependencies=[Depends(no_query)],
    )
    async def login(request: Request, body: ChallengeRequest) -> dict[str, str]:
        require_service(request, settings)
        if not valid_customer_number(body.customer_number):
            raise APIError(400, "VALIDATION_FAILED", "Invalid customer number.")
        async with sessions() as session, session.begin():
            store = Identity(session, settings)
            conversation = await store.conversation(
                request.headers.get("X-Conversation-Token", "")
            )
            if isinstance(conversation, APIError):
                raise conversation
            error = await store.limits(
                [
                    ("supabase_login:number", body.customer_number, 3, 900, 60),
                    (
                        "supabase_login:ip",
                        str(conversation.client_ip or "unknown"),
                        10,
                        3600,
                        0,
                    ),
                    ("supabase_login:conversation", str(conversation.id), 5, 0, 0),
                ]
            )
            if error:
                raise error
            patient = await session.scalar(
                select(Patient).where(Patient.customer_number == body.customer_number)
            )
            email = patient.email if patient and patient.supabase_user_id else None
        if email:
            await auth.send_existing_otp(email)
        return {"delivery": "email_on_file"}

    @router.post(
        "/logout", status_code=204, responses=errors, dependencies=[Depends(browser)]
    )
    async def logout(request: Request) -> Response:
        user = await auth.verify_access_token(bearer(request))
        async with sessions() as session, session.begin():
            store = Identity(session, settings)
            conversation = await store.conversation(
                request.headers.get("X-Conversation-Token", "")
            )
            if isinstance(conversation, APIError):
                raise conversation
            binding = await session.scalar(
                select(PatientSession)
                .join(Patient, Patient.id == PatientSession.patient_id)
                .where(
                    PatientSession.conversation_session_id == conversation.id,
                    PatientSession.supabase_session_id == user.session_id,
                    Patient.supabase_user_id == user.user_id,
                )
                .order_by(PatientSession.created_at.desc())
                .limit(1)
            )
            if binding is None:
                raise APIError(401, "VERIFICATION_REQUIRED", "Authentication required.")
            await revoke(session, conversation.id, "logout", datetime.now(UTC))
        await auth.logout(bearer(request))
        return Response(status_code=204, headers={"Cache-Control": "no-store"})

    return router
