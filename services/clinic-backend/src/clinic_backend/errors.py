from datetime import UTC, datetime

from fastapi import Request
from pydantic import BaseModel
from starlette.responses import JSONResponse


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: dict[str, object] | None
    request_id: str
    timestamp: str


class ErrorEnvelope(BaseModel):
    error: ErrorDetail


class APIError(Exception):
    def __init__(
        self,
        status: int,
        code: str,
        message: str,
        details: dict[str, object] | None = None,
    ) -> None:
        self.status = status
        self.code = code
        self.message = message
        self.details = details


def error_response(
    request: Request,
    status: int,
    code: str,
    message: str,
    details: dict[str, object] | None = None,
) -> JSONResponse:
    envelope = ErrorEnvelope(
        error=ErrorDetail(
            code=code,
            message=message,
            details=details,
            request_id=request.state.request_id,
            timestamp=datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        )
    )
    return JSONResponse(
        envelope.model_dump(),
        status_code=status,
        headers={"X-Request-Id": request.state.request_id},
    )
