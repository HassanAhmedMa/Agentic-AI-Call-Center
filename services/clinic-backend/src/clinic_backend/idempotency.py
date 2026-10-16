from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, LargeBinary, SmallInteger, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from clinic_backend.models import Base


class IdempotencyKey(Base):
    __tablename__ = "idempotency_keys"
    patient_id: Mapped[int] = mapped_column(
        ForeignKey("patients.id", ondelete="CASCADE"), primary_key=True
    )
    operation: Mapped[str] = mapped_column(String(32), primary_key=True)
    idempotency_key: Mapped[str] = mapped_column(String(128), primary_key=True)
    request_hash: Mapped[bytes] = mapped_column(LargeBinary)
    response_status: Mapped[int | None] = mapped_column(SmallInteger)
    response_body: Mapped[dict[str, object] | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
