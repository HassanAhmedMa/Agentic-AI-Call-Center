"""Opaque conversation credentials and serialized transport lifecycle."""

import hashlib
import hmac
import ipaddress
import math
import secrets
from datetime import UTC, datetime, timedelta
from typing import Annotated

from clinic_schemas.conversations import (
    ConversationCreate,
    ConversationCreated,
    ConversationEvent,
)
from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from starlette.responses import Response

from clinic_backend.errors import APIError, ErrorEnvelope, error_response
from clinic_backend.models import ConversationSession, RateLimitEvent
from clinic_backend.settings import Settings

RESUME_SECONDS = 300


def require_service(request: Request, settings: Settings) -> None:
    expected = settings.agent_service_token
    supplied = request.headers.get("X-Service-Token", "")
    if expected is None or not hmac.compare_digest(
        supplied.encode(), expected.get_secret_value().encode()
    ):
        raise APIError(401, "SERVICE_AUTH_REQUIRED", "Service authentication required.")


async def find_conversation(
    session: AsyncSession, token: str, now: datetime
) -> ConversationSession | None:
    if not token or len(token) > 128:
        return None
    row = await session.scalar(
        select(ConversationSession)
        .where(
            ConversationSession.token_hash == hashlib.sha256(token.encode()).digest()
        )
        .with_for_update()
    )
    if row is None or row.status == "ended":
        return None
    # Re-evaluate after acquiring the lock, which may have waited on another
    # request. An old request timestamp must not reopen an expired conversation.
    now = datetime.now(UTC)
    if row.status == "disconnected" and (
        row.disconnected_at is None
        or row.disconnected_at + timedelta(seconds=RESUME_SECONDS) <= now
    ):
        row.status = "ended"
        row.ended_at = now
        from clinic_backend.identity import revoke

        await revoke(session, row.id, "resume_expired", now)
        return None
    return row


async def creation_retry(session: AsyncSession, subject: str, now: datetime) -> int:
    # Transaction-level advisory locks work across backend processes. Namespace
    # the lock with current_schema to keep isolated test databases independent.
    await session.execute(
        text(
            "SELECT pg_advisory_xact_lock("
            "hashtextextended(current_schema() || :key, 0))"
        ),
        {"key": ":conversation-create:" + subject},
    )
    count, oldest = (
        await session.execute(
            select(func.count(), func.min(RateLimitEvent.created_at)).where(
                RateLimitEvent.bucket == "conversation_create",
                RateLimitEvent.subject == subject,
                RateLimitEvent.created_at > now - timedelta(hours=1),
            )
        )
    ).one()
    if count >= 10:
        assert oldest is not None
        return int(
            max(1, math.ceil((oldest + timedelta(hours=1) - now).total_seconds()))
        )
    session.add(
        RateLimitEvent(bucket="conversation_create", subject=subject, created_at=now)
    )
    return 0


def conversation_router(
    sessions: async_sessionmaker[AsyncSession], settings: Settings
) -> APIRouter:
    router = APIRouter(prefix="/api/v1/conversations", tags=["Conversations"])

    async def no_query(request: Request) -> None:
        if request.query_params:
            raise APIError(400, "VALIDATION_FAILED", "Unexpected query parameters.")

    async def service_auth(
        request: Request,
        service_token: Annotated[str | None, Header(alias="X-Service-Token")] = None,
    ) -> None:
        require_service(request, settings)

    @router.post(
        "",
        status_code=201,
        response_model=ConversationCreated,
        dependencies=[Depends(no_query)],
        responses={
            400: {"model": ErrorEnvelope},
            429: {"model": ErrorEnvelope},
            503: {"model": ErrorEnvelope},
        },
    )
    async def create(body: ConversationCreate, request: Request) -> Response:
        peer = request.client.host if request.client else "unknown"
        try:
            client_ip = str(ipaddress.ip_address(peer))
        except ValueError:
            client_ip = None
        now = datetime.now(UTC)
        response: Response
        async with sessions() as session, session.begin():
            retry = await creation_retry(session, client_ip or "unknown", now)
            if not retry:
                token = secrets.token_urlsafe(32)
                session.add(
                    ConversationSession(
                        token_hash=hashlib.sha256(token.encode()).digest(),
                        channel=body.channel,
                        status="active",
                        client_ip=client_ip,
                        started_at=now,
                        last_seen_at=now,
                    )
                )
        if retry:
            response = error_response(
                request, 429, "RATE_LIMITED", "Too many requests. Try again later."
            )
            response.headers["Retry-After"] = str(retry)
        else:
            response = Response(
                ConversationCreated(
                    conversation_token=token, channel=body.channel
                ).model_dump_json(),
                status_code=201,
                media_type="application/json",
            )
        response.headers["Cache-Control"] = "no-store"
        return response

    @router.post(
        "/current/events",
        status_code=204,
        dependencies=[Depends(service_auth), Depends(no_query)],
        responses={
            400: {"model": ErrorEnvelope},
            401: {"model": ErrorEnvelope},
            503: {"model": ErrorEnvelope},
        },
    )
    async def event(
        body: ConversationEvent,
        request: Request,
        conversation_token: Annotated[
            str | None, Header(alias="X-Conversation-Token")
        ] = None,
    ) -> Response:
        now = datetime.now(UTC)
        async with sessions() as session, session.begin():
            row = await find_conversation(session, conversation_token or "", now)
            if row is not None:
                now = datetime.now(UTC)
                row.last_seen_at = now
                if body.event == "ended":
                    row.status = "ended"
                    row.ended_at = now
                    from clinic_backend.identity import revoke

                    await revoke(session, row.id, "call_ended", now)
                elif body.event == "disconnected" and row.status == "active":
                    row.status = "disconnected"
                    row.disconnected_at = now
                elif body.event == "reconnected":
                    row.status = "active"
                    row.disconnected_at = None
        # Raise after transaction exits so expiry is committed, never rolled back.
        if row is None:
            raise APIError(401, "CONVERSATION_INVALID", "Conversation must restart.")
        return Response(status_code=204, headers={"Cache-Control": "no-store"})

    return router
