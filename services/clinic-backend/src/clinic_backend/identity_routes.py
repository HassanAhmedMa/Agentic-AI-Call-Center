import logging
from collections.abc import Awaitable, Callable
from typing import Annotated, Any

from clinic_schemas import identity as dto
from fastapi import APIRouter, Depends, Header, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from starlette.responses import JSONResponse, Response

from clinic_backend.conversations import require_service
from clinic_backend.errors import APIError, ErrorEnvelope
from clinic_backend.identity import Identity, socket_ip, valid_customer_number
from clinic_backend.mail import Delivery
from clinic_backend.models import ConversationSession
from clinic_backend.settings import Settings


def identity_router(
    sessions: async_sessionmaker[AsyncSession], settings: Settings, mailer: Delivery
) -> APIRouter:
    router = APIRouter(prefix="/api/v1", tags=["Patient identity"])

    async def authorize(request: Request, role: str) -> None:
        if role == "browser" and "X-Service-Token" in request.headers:
            raise APIError(403, "ACTION_NOT_ALLOWED", "Use the browser form directly.")
        if role == "service" or (
            role == "poll" and "X-Service-Token" in request.headers
        ):
            require_service(request, settings)
        if request.query_params:
            raise APIError(400, "VALIDATION_FAILED", "Unexpected query parameters.")
        async with sessions() as session, session.begin():
            result = await Identity(session, settings).conversation(
                request.headers.get("X-Conversation-Token", "")
            )
        if isinstance(result, APIError):
            raise result

    async def browser(
        request: Request,
        token: Annotated[str | None, Header(alias="X-Conversation-Token")] = None,
    ) -> None:
        await authorize(request, "browser")

    async def service(
        request: Request,
        token: Annotated[str | None, Header(alias="X-Conversation-Token")] = None,
        credential: Annotated[str | None, Header(alias="X-Service-Token")] = None,
    ) -> None:
        await authorize(request, "service")

    async def poll_auth(
        request: Request,
        token: Annotated[str | None, Header(alias="X-Conversation-Token")] = None,
        credential: Annotated[str | None, Header(alias="X-Service-Token")] = None,
    ) -> None:
        await authorize(request, "poll")

    async def execute(
        request: Request,
        operation: Callable[[Identity, ConversationSession], Awaitable[Any]],
        delivery_required: bool = False,
    ) -> Any:
        reserved = delivery_required and mailer.reserve()
        if delivery_required and not reserved:
            raise APIError(
                503, "SERVICE_UNAVAILABLE", "Mail delivery temporarily unavailable."
            )
        try:
            async with sessions() as session, session.begin():
                identity = Identity(session, settings)
                conversation = await identity.conversation(
                    request.headers.get("X-Conversation-Token", "")
                )
                result = (
                    conversation
                    if isinstance(conversation, APIError)
                    else await operation(identity, conversation)
                )
            if isinstance(result, APIError):
                raise result
            if isinstance(result, tuple):
                data, message = result
                if isinstance(data, APIError):
                    raise data
                if reserved:
                    mailer.enqueue(message)
                    reserved = False
                elif message is not None:
                    # Welcome email is secondary: never hide a committed
                    # verification/customer number because delivery is full.
                    if mailer.reserve():
                        mailer.enqueue(message)
                    else:
                        logging.getLogger("clinic_backend.mail").error(
                            "Welcome email delivery unavailable; "
                            "operator action required"
                        )
                return data
            return result
        finally:
            if reserved:
                mailer.release()

    def response(model: BaseModel, status: int = 200) -> Response:
        return JSONResponse(
            model.model_dump(mode="json", exclude_none=True),
            status_code=status,
            headers={"Cache-Control": "no-store"},
        )

    errors: dict[int | str, dict[str, Any]] = {
        code: {"model": ErrorEnvelope}
        for code in [400, 401, 403, 409, 410, 422, 429, 503]
    }

    @router.post(
        "/registrations",
        status_code=202,
        response_model=dto.ChallengeResponse,
        response_model_exclude_none=True,
        dependencies=[Depends(browser)],
        responses=errors,
    )
    async def registration(body: dto.Registration, request: Request) -> Response:
        if not mailer.available():
            raise APIError(
                503, "SERVICE_UNAVAILABLE", "Mail delivery temporarily unavailable."
            )
        peer = socket_ip(request.client.host if request.client else None)
        result = await execute(
            request,
            lambda identity, conversation: identity.start(
                conversation, "registration", peer, form=body
            ),
            delivery_required=True,
        )
        return response(result, 202)

    @router.post(
        "/verification/challenges",
        status_code=202,
        response_model=dto.ChallengeResponse,
        response_model_exclude_none=True,
        dependencies=[Depends(service)],
        responses=errors,
    )
    async def challenge(body: dto.ChallengeRequest, request: Request) -> Response:
        if not valid_customer_number(body.customer_number):
            raise APIError(422, "INVALID_CUSTOMER_NUMBER", "Invalid customer number.")
        if not mailer.available():
            raise APIError(
                503, "SERVICE_UNAVAILABLE", "Mail delivery temporarily unavailable."
            )
        result = await execute(
            request,
            lambda identity, conversation: identity.start(
                conversation, "login", None, number=body.customer_number
            ),
            delivery_required=True,
        )
        return response(result, 202)

    @router.post(
        "/verification/verify",
        response_model=dto.Verified,
        response_model_exclude_none=True,
        dependencies=[Depends(browser)],
        responses=errors,
    )
    async def verify(body: dto.CodeEntry, request: Request) -> Response:
        peer = socket_ip(request.client.host if request.client else None)
        result = await execute(
            request,
            lambda identity, conversation: identity.verify(conversation, body, peer),
        )
        return response(result)

    @router.get(
        "/conversations/current/verification",
        response_model=dto.VerificationState,
        response_model_exclude_none=True,
        dependencies=[Depends(poll_auth)],
        responses=errors,
    )
    async def poll(request: Request) -> Response:
        return response(
            await execute(
                request, lambda identity, conversation: identity.poll(conversation)
            )
        )

    @router.get(
        "/patients/me",
        response_model=dto.PatientProfile,
        dependencies=[Depends(service)],
        responses=errors,
    )
    async def profile(request: Request) -> Response:
        return response(
            await execute(
                request, lambda identity, conversation: identity.profile(conversation)
            )
        )

    @router.post(
        "/patients/me/logout",
        status_code=204,
        dependencies=[Depends(service)],
        responses=errors,
    )
    async def logout(request: Request) -> Response:
        await execute(
            request,
            lambda identity, conversation: identity.profile(conversation, logout=True),
        )
        return Response(status_code=204, headers={"Cache-Control": "no-store"})

    return router
