"""Deterministic identity transactions. Patient is derived only from conversation."""

import hmac
import ipaddress
import math
import re
import secrets
from datetime import UTC, date, datetime, timedelta
from uuid import UUID

from clinic_schemas import identity as dto
from sqlalchemy import func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from clinic_backend.conversations import find_conversation
from clinic_backend.errors import APIError
from clinic_backend.identity_models import Challenge, Patient, PatientSession
from clinic_backend.mail import (
    Mail,
    duplicate_mail,
    number_mail,
    verification_mail,
)
from clinic_backend.models import ConversationSession, RateLimitEvent
from clinic_backend.settings import Settings


def valid_customer_number(value: str) -> bool:
    if not re.fullmatch(r"[0-9]{6}", value):
        return False
    total = 0
    for index, character in enumerate(reversed(value)):
        digit = int(character)
        if index % 2:
            digit *= 2
            digit = digit - 9 if digit > 9 else digit
        total += digit
    return total % 10 == 0


def customer_number() -> str:
    base = f"{secrets.randbelow(100000):05d}"
    return next(
        base + str(digit)
        for digit in range(10)
        if valid_customer_number(base + str(digit))
    )


def socket_ip(peer: str | None) -> str | None:
    try:
        return str(ipaddress.ip_address(peer or ""))
    except ValueError:
        return None


def wipe(challenge: Challenge, status: str) -> None:
    challenge.status = status
    challenge.code_hash = None
    challenge.pending_registration = None


async def revoke(
    session: AsyncSession, conversation_id: UUID, reason: str, now: datetime
) -> None:
    await session.execute(
        update(PatientSession)
        .where(
            PatientSession.conversation_session_id == conversation_id,
            PatientSession.revoked_at.is_(None),
        )
        .values(revoked_at=now, revoke_reason=reason)
    )
    await session.execute(
        update(Challenge)
        .where(
            Challenge.conversation_session_id == conversation_id,
            Challenge.status == "pending",
        )
        .values(status="superseded", code_hash=None, pending_registration=None)
    )


class Identity:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self.session = session
        self.settings = settings
        assert settings.otp_hmac_secret is not None
        self.key = settings.otp_hmac_secret.get_secret_value().encode()

    def digest(self, value: str) -> bytes:
        return hmac.digest(self.key, value.encode(), "sha256")

    async def conversation(self, token: str) -> ConversationSession | APIError:
        row = await find_conversation(self.session, token, datetime.now(UTC))
        if row is None:
            return APIError(401, "CONVERSATION_INVALID", "Conversation must restart.")
        return row

    async def lock(self, key: str) -> None:
        await self.session.execute(
            text(
                "SELECT pg_advisory_xact_lock("
                "hashtextextended(current_schema() || :key, 0))"
            ),
            {"key": key},
        )

    async def limits(
        self, buckets: list[tuple[str, str, int, int, int]]
    ) -> APIError | None:
        # All limits are checked before any event is appended. Sorted locks
        # prevent count-then-insert races and cross-bucket deadlocks.
        for bucket, subject, _, _, _ in sorted(buckets):
            await self.lock(":" + bucket + ":" + subject)
        now = datetime.now(UTC)
        retry = 0
        for bucket, subject, maximum, window, cooldown in buckets:
            predicate = [
                RateLimitEvent.bucket == bucket,
                RateLimitEvent.subject == subject,
            ]
            if window:
                predicate.append(
                    RateLimitEvent.created_at > now - timedelta(seconds=window)
                )
            count, oldest, newest = (
                await self.session.execute(
                    select(
                        func.count(),
                        func.min(RateLimitEvent.created_at),
                        func.max(RateLimitEvent.created_at),
                    ).where(*predicate)
                )
            ).one()
            if count >= maximum:
                retry = max(
                    retry,
                    (
                        math.ceil(
                            (oldest + timedelta(seconds=window) - now).total_seconds()
                        )
                        if window
                        else 3600
                    ),
                )
            if cooldown and newest:
                retry = max(
                    retry,
                    math.ceil(
                        (newest + timedelta(seconds=cooldown) - now).total_seconds()
                    ),
                )
        if retry > 0:
            return APIError(
                429,
                "RATE_LIMITED",
                "Too many requests. Try again later.",
                {"retry_after": retry},
            )
        for bucket, subject, _, _, _ in buckets:
            self.session.add(
                RateLimitEvent(bucket=bucket, subject=subject, created_at=now)
            )
        await self.session.flush()
        return None

    async def pending(self, conversation: ConversationSession, purpose: str) -> None:
        await self.session.execute(
            update(Challenge)
            .where(
                Challenge.conversation_session_id == conversation.id,
                Challenge.purpose == purpose,
                Challenge.status == "pending",
            )
            .values(status="superseded", code_hash=None, pending_registration=None)
        )

    async def start(
        self,
        conversation: ConversationSession,
        purpose: str,
        peer: str | None,
        form: dto.Registration | None = None,
        number: str | None = None,
    ) -> tuple[dto.ChallengeResponse | APIError, Mail | None]:
        ip = (
            peer
            if purpose == "registration"
            else str(conversation.client_ip) if conversation.client_ip else None
        )
        identity = self.digest("email:" + form.email).hex() if form else number or ""
        buckets = [
            (
                "otp_send:email" if form else "otp_send:customer",
                identity,
                self.settings.otp_max_sends_per_identity,
                self.settings.otp_send_window_seconds,
                self.settings.otp_send_cooldown_seconds,
            ),
            (
                "otp_send:ip",
                ip or "unknown",
                self.settings.otp_max_sends_per_ip,
                self.settings.otp_ip_window_seconds,
                0,
            ),
            (
                "otp_send:conversation",
                str(conversation.id),
                self.settings.otp_max_sends_per_conversation,
                0,
                0,
            ),
        ]
        if conversation.otp_send_count >= self.settings.otp_max_sends_per_conversation:
            return (
                APIError(
                    429,
                    "RATE_LIMITED",
                    "Start a new conversation.",
                    {"retry_after": 3600},
                ),
                None,
            )
        if form:
            buckets.append(
                (
                    "registration:ip",
                    ip or "unknown",
                    self.settings.registration_max_per_ip_per_day,
                    86400,
                    0,
                )
            )
        limited = await self.limits(buckets)
        if limited:
            return limited, None
        conversation.otp_send_count += 1
        await self.pending(conversation, purpose)
        now = datetime.now(UTC)
        expires = now + timedelta(seconds=self.settings.otp_ttl_seconds)
        code = f"{secrets.randbelow(1000000):06d}"
        patient = (
            await self.session.scalar(
                select(Patient).where(func.lower(Patient.email) == form.email)
            )
            if form
            else await self.session.scalar(
                select(Patient).where(Patient.customer_number == number)
            )
        )
        usable = patient is None if form else patient is not None
        message = None
        if form:
            message = (
                verification_mail(form.email, code, form.preferred_language)
                if usable
                else (
                    duplicate_mail(patient.email, patient.preferred_language)
                    if patient
                    else None
                )
            )
        elif patient:
            message = verification_mail(patient.email, code, patient.preferred_language)
        self.session.add(
            Challenge(
                purpose=purpose,
                conversation_session_id=conversation.id,
                patient_id=patient.id if patient and not form else None,
                pending_registration=(
                    form.model_dump(mode="json", exclude={"privacy_notice_accepted"})
                    if form and usable
                    else None
                ),
                code_hash=(
                    self.digest(
                        "code:" + str(conversation.id) + ":" + purpose + ":" + code
                    )
                    if usable
                    else None
                ),
                status="pending",
                failed_attempts=0,
                client_ip=ip,
                created_at=now,
                expires_at=expires,
            )
        )
        return (
            dto.ChallengeResponse(
                purpose=purpose,
                expires_at=expires,
                delivery="email_on_file" if purpose == "login" else None,
            ),
            message,
        )

    async def live_session(
        self, conversation: ConversationSession, refresh: bool
    ) -> tuple[PatientSession | None, bool]:
        row = await self.session.scalar(
            select(PatientSession)
            .where(
                PatientSession.conversation_session_id == conversation.id,
                PatientSession.revoked_at.is_(None),
            )
            .with_for_update()
        )
        now = datetime.now(UTC)
        expired = False
        if row and (
            row.expires_at <= now
            or row.last_activity_at
            + timedelta(seconds=self.settings.patient_session_idle_seconds)
            <= now
        ):
            row.revoked_at = now
            row = None
            expired = True
        if row and refresh:
            row.last_activity_at = now
        return row, expired

    async def poll(self, conversation: ConversationSession) -> dto.VerificationState:
        live, _ = await self.live_session(conversation, refresh=False)
        now = datetime.now(UTC)
        pending = list(
            (
                await self.session.scalars(
                    select(Challenge)
                    .where(
                        Challenge.conversation_session_id == conversation.id,
                        Challenge.status == "pending",
                    )
                    .order_by(Challenge.created_at.desc())
                )
            ).all()
        )
        for challenge in pending:
            if challenge.expires_at <= now:
                wipe(challenge, "expired")
            else:
                return dto.VerificationState(
                    state="pending",
                    purpose=challenge.purpose,
                    expires_at=challenge.expires_at,
                )
        if live:
            verified_challenge = (
                await self.session.get(Challenge, live.verified_via)
                if live.verified_via
                else None
            )
            purpose = verified_challenge.purpose if verified_challenge else "login"
            return dto.VerificationState(
                state="verified", purpose=purpose, verified_at=live.created_at
            )
        return dto.VerificationState(state="none")

    async def verify(
        self, conversation: ConversationSession, body: dto.CodeEntry, peer: str | None
    ) -> tuple[dto.Verified | APIError, Mail | None]:
        challenge = await self.session.scalar(
            select(Challenge)
            .where(
                Challenge.conversation_session_id == conversation.id,
                Challenge.purpose == body.purpose,
            )
            .order_by(Challenge.created_at.desc(), Challenge.id)
            .limit(1)
            .with_for_update()
        )
        if challenge is None or challenge.status == "verified":
            return APIError(409, "NO_PENDING_CHALLENGE", "Request a new code."), None
        now = datetime.now(UTC)
        if challenge.status == "pending" and challenge.expires_at <= now:
            wipe(challenge, "expired")
        if challenge.status != "pending":
            reason = (
                "too_many_attempts"
                if challenge.status == "failed"
                else challenge.status
            )
            return (
                APIError(
                    410, "CHALLENGE_EXPIRED", "Request a new code.", {"reason": reason}
                ),
                None,
            )
        # Check the failure bucket before comparisons, append only for failures.
        bucket, subject = "otp_fail:ip", peer or "unknown"
        await self.lock(":" + bucket + ":" + subject)
        failures = await self.session.scalar(
            select(func.count())
            .select_from(RateLimitEvent)
            .where(
                RateLimitEvent.bucket == bucket,
                RateLimitEvent.subject == subject,
                RateLimitEvent.created_at > now - timedelta(hours=1),
            )
        )
        if failures is not None and failures >= self.settings.otp_max_failures_per_ip:
            return (
                APIError(
                    429, "RATE_LIMITED", "Too many attempts.", {"retry_after": 3600}
                ),
                None,
            )
        supplied = self.digest(
            "code:" + str(conversation.id) + ":" + body.purpose + ":" + body.code
        )
        matches = hmac.compare_digest(challenge.code_hash or bytes(32), supplied)
        usable = matches and challenge.code_hash is not None
        patient = None
        message = None
        if usable and body.purpose == "registration":
            form = challenge.pending_registration
            usable = form is not None
            if form:
                await self.lock(":patient-email:" + self.digest(form["email"]).hex())
                existing = await self.session.scalar(
                    select(Patient.id).where(func.lower(Patient.email) == form["email"])
                )
                usable = existing is None
                if usable:
                    # Serialize generation with the existing-number check so a
                    # unique collision is retried without aborting the transaction.
                    await self.lock(":patient-number-allocation")
                    number = customer_number()
                    for _ in range(1000):
                        if (
                            await self.session.scalar(
                                select(Patient.id).where(
                                    Patient.customer_number == number
                                )
                            )
                            is None
                        ):
                            break
                        number = customer_number()
                    else:
                        return (
                            APIError(
                                503,
                                "SERVICE_UNAVAILABLE",
                                "Account allocation unavailable.",
                            ),
                            None,
                        )
                    patient = Patient(
                        customer_number=number,
                        full_name=form["full_name"],
                        email=form["email"],
                        phone=form["phone"],
                        date_of_birth=date.fromisoformat(form["date_of_birth"]),
                        preferred_language=form["preferred_language"],
                        email_verified_at=now,
                    )
                    self.session.add(patient)
                    await self.session.flush()
                    message = number_mail(
                        patient.email, number, patient.preferred_language
                    )
        elif usable and challenge.patient_id:
            patient = await self.session.get(Patient, challenge.patient_id)
            usable = patient is not None
        else:
            usable = False
        if not usable or patient is None:
            challenge.failed_attempts += 1
            self.session.add(
                RateLimitEvent(bucket=bucket, subject=subject, created_at=now)
            )
            if challenge.failed_attempts >= self.settings.otp_max_attempts:
                wipe(challenge, "failed")
            return (
                APIError(
                    422,
                    "INVALID_CODE",
                    "Invalid verification code.",
                    {
                        "attempts_remaining": self.settings.otp_max_attempts
                        - challenge.failed_attempts
                    },
                ),
                None,
            )
        await self.live_session(conversation, refresh=False)
        await revoke(self.session, conversation.id, "account_switch", now)
        wipe(challenge, "verified")
        challenge.verified_at = now
        await self.session.flush()
        self.session.add(
            PatientSession(
                patient_id=patient.id,
                conversation_session_id=conversation.id,
                verified_via=challenge.id,
                created_at=now,
                last_activity_at=now,
                expires_at=now
                + timedelta(seconds=self.settings.patient_session_absolute_seconds),
            )
        )
        return (
            dto.Verified(
                purpose=body.purpose,
                customer_number=(
                    patient.customer_number if body.purpose == "registration" else None
                ),
            ),
            message,
        )

    async def profile(
        self, conversation: ConversationSession, logout: bool = False
    ) -> dto.PatientProfile | APIError | None:
        binding, expired = await self.live_session(conversation, refresh=True)
        if binding is None:
            historical = await self.session.scalar(
                select(PatientSession.id)
                .where(PatientSession.conversation_session_id == conversation.id)
                .limit(1)
            )
            return APIError(
                401,
                "SESSION_EXPIRED" if expired or historical else "VERIFICATION_REQUIRED",
                "Patient verification required.",
            )
        if logout:
            await revoke(self.session, conversation.id, "logout", datetime.now(UTC))
            return None
        patient = await self.session.get(Patient, binding.patient_id)
        assert patient is not None
        return dto.PatientProfile(
            customer_number=patient.customer_number,
            first_name=patient.full_name.split()[0],
            preferred_language=patient.preferred_language,
        )
