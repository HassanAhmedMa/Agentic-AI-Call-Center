from datetime import UTC, datetime, timedelta
from uuid import UUID

from clinic_schemas.identity import PatientProfile, Registration
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from clinic_backend.errors import APIError
from clinic_backend.identity import Identity, customer_number, revoke
from clinic_backend.identity_models import Patient, PatientSession
from clinic_backend.models import ConversationSession
from clinic_backend.supabase_auth import VerifiedAuthUser


async def active_auth_session(
    session: AsyncSession, user_id: UUID, session_id: UUID
) -> bool:
    return bool(
        await session.scalar(
            text("SELECT auth_session_active(:u,:s)"), {"u": user_id, "s": session_id}
        )
    )


class SupabaseIdentity(Identity):
    async def complete(
        self,
        conversation: ConversationSession,
        user: VerifiedAuthUser,
        form: Registration | None,
    ) -> PatientProfile:
        if not await active_auth_session(self.session, user.user_id, user.session_id):
            raise APIError(401, "SESSION_EXPIRED", "Authenticate again.")
        if form is not None and form.email != user.email:
            raise APIError(
                409, "IDENTITY_CONFLICT", "Verified identity does not match."
            )
        await self.lock(":supabase-email:" + user.email)
        await self.lock(":supabase-user:" + str(user.user_id))
        patient = await self.session.scalar(
            select(Patient)
            .where(Patient.supabase_user_id == user.user_id)
            .with_for_update()
        )
        if patient is not None and patient.email.lower() != user.email:
            raise APIError(409, "IDENTITY_CONFLICT", "Account recovery required.")
        if patient is None:
            patient = await self.session.scalar(
                select(Patient)
                .where(func.lower(Patient.email) == user.email)
                .with_for_update()
            )
            if patient and patient.supabase_user_id not in (None, user.user_id):
                raise APIError(409, "IDENTITY_CONFLICT", "Account recovery required.")
        if patient is None:
            if form is None:
                raise APIError(
                    409, "REGISTRATION_REQUIRED", "Complete your clinic profile."
                )
            error = await self.limits(
                [
                    (
                        "registration:ip",
                        str(conversation.client_ip or "unknown"),
                        self.settings.registration_max_per_ip_per_day,
                        86400,
                        0,
                    )
                ]
            )
            if error:
                raise error
            for _ in range(10):
                try:
                    async with self.session.begin_nested():
                        patient = Patient(
                            **form.model_dump(exclude={"privacy_notice_accepted"}),
                            customer_number=customer_number(),
                            email_verified_at=user.email_verified_at,
                            supabase_user_id=user.user_id,
                        )
                        self.session.add(patient)
                        await self.session.flush()
                    break
                except IntegrityError as exc:
                    if "customer_number" not in str(exc.orig):
                        raise APIError(
                            409, "IDENTITY_CONFLICT", "Account recovery required."
                        ) from None
            else:
                raise APIError(503, "SERVICE_UNAVAILABLE", "Try again later.")
        assert patient is not None
        patient.supabase_user_id = user.user_id
        current, _ = await self.live_session(conversation, refresh=False)
        if (
            current is None
            or current.patient_id != patient.id
            or current.supabase_session_id != user.session_id
        ):
            await revoke(
                self.session, conversation.id, "account_switch", datetime.now(UTC)
            )
            await self.session.flush()
            now = datetime.now(UTC)
            self.session.add(
                PatientSession(
                    patient_id=patient.id,
                    conversation_session_id=conversation.id,
                    supabase_session_id=user.session_id,
                    created_at=now,
                    last_activity_at=now,
                    expires_at=now
                    + timedelta(seconds=self.settings.patient_session_absolute_seconds),
                )
            )
        await self.session.flush()
        return PatientProfile(
            customer_number=patient.customer_number,
            first_name=patient.full_name.split()[0],
            preferred_language=patient.preferred_language,
        )
