import asyncio
import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from clinic_backend.idempotency import IdempotencyKey
from clinic_backend.identity import Identity, revoke, wipe
from clinic_backend.identity_models import Challenge, PatientSession
from clinic_backend.models import ConversationSession, RateLimitEvent
from clinic_backend.settings import Settings

logger = logging.getLogger("clinic_backend.cleanup")


async def cleanup(
    sessions: async_sessionmaker[AsyncSession], settings: Settings
) -> None:
    now = datetime.now(UTC)
    async with sessions() as session, session.begin():
        await session.execute(
            delete(IdempotencyKey).where(IdempotencyKey.expires_at <= now)
        )
        # Same lock order as request paths; skip busy conversations. The bounded
        # synthetic milestone has a small session population; batch at scale.
        conversations = list(
            (
                await session.scalars(
                    select(ConversationSession).with_for_update(skip_locked=True)
                )
            ).all()
        )
        for conversation in conversations:
            if (
                conversation.status == "disconnected"
                and conversation.disconnected_at
                and conversation.disconnected_at + timedelta(minutes=5) <= now
            ):
                conversation.status = "ended"
                conversation.ended_at = now
                await revoke(session, conversation.id, "resume_expired", now)
            elif conversation.status == "ended":
                await revoke(session, conversation.id, "call_ended", now)
            await Identity(session, settings).live_session(conversation, refresh=False)
            challenges = list(
                (
                    await session.scalars(
                        select(Challenge).where(
                            Challenge.conversation_session_id == conversation.id
                        )
                    )
                ).all()
            )
            for challenge in challenges:
                if challenge.status == "pending" and challenge.expires_at <= now:
                    wipe(challenge, "expired")
                if challenge.created_at <= now - timedelta(hours=24):
                    await session.delete(challenge)
            await session.flush()
            await session.execute(
                delete(PatientSession).where(
                    PatientSession.conversation_session_id == conversation.id,
                    PatientSession.created_at <= now - timedelta(days=30),
                )
            )
            if conversation.started_at <= now - timedelta(days=30):
                await session.delete(conversation)
        await session.execute(
            delete(RateLimitEvent).where(
                RateLimitEvent.created_at < now - timedelta(hours=24)
            )
        )


async def cleanup_loop(
    sessions: async_sessionmaker[AsyncSession], settings: Settings
) -> None:
    while True:
        try:
            await cleanup(sessions, settings)
        except Exception as exc:
            logger.error("Identity cleanup failed type=%s", type(exc).__name__)
        await asyncio.sleep(60)
