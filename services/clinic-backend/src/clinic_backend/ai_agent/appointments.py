"""Controlled HTTP adapter. Model arguments never carry identity credentials."""

from typing import Any

import httpx
from clinic_schemas import bookings as booking
from clinic_schemas.availability import AvailabilityQuery


class AppointmentAPI:
    def __init__(
        self,
        client: httpx.AsyncClient,
        conversation_token: str,
        service_token: str | None,
    ) -> None:
        self.client = client
        self.headers = {"X-Conversation-Token": conversation_token}
        if service_token:
            self.headers["X-Service-Token"] = service_token

    async def request(
        self,
        method: str,
        path: str,
        *,
        body: dict[str, Any] | None = None,
        key: str | None = None,
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        headers = dict(self.headers)
        if key:
            headers["Idempotency-Key"] = key
        response = await self.client.request(
            method, "/api/v1/" + path, headers=headers, json=body, params=params
        )
        response.raise_for_status()
        return dict(response.json())

    async def patient_context(self) -> dict[str, Any]:
        # The HTTP client carries browser cookies; profile() verifies Supabase
        # access, live session binding and patient identity before returning data.
        response = await self.client.get("/api/v1/portal/session")
        response.raise_for_status()
        self.profile_cookie_headers = response.headers.get_list("set-cookie")
        profile = response.json()
        return {
            "first_name": profile.get("first_name", ""),
            "preferred_language": profile.get("preferred_language", "ar"),
            "profile_complete": True,
        }

    async def availability(
        self, doctor_id: int, query: dict[str, Any]
    ) -> dict[str, Any]:
        if type(doctor_id) is not int or doctor_id <= 0:
            raise ValueError("Invalid doctor identifier")
        params = AvailabilityQuery.model_validate(query).model_dump(mode="json")
        return await self.request(
            "GET", f"doctors/{doctor_id}/availability", params=params
        )

    async def appointments(self, query: dict[str, Any] | None = None) -> dict[str, Any]:
        params = booking.AppointmentQuery.model_validate(query or {}).model_dump(
            mode="json", exclude_none=True
        )
        return await self.request("GET", "patients/me/appointments", params=params)

    async def book(self, body: dict[str, Any], key: str) -> dict[str, Any]:
        payload = booking.Book.model_validate(body).model_dump(
            mode="json", exclude_none=True
        )
        return await self.request(
            "POST", "patients/me/appointments", body=payload, key=key
        )

    async def reschedule(
        self, appointment_id: int, body: dict[str, Any], key: str
    ) -> dict[str, Any]:
        self.validate_id(appointment_id)
        payload = booking.Slot.model_validate(body).model_dump(mode="json")
        return await self.request(
            "POST",
            f"patients/me/appointments/{appointment_id}/reschedule",
            body=payload,
            key=key,
        )

    async def cancel(
        self, appointment_id: int, body: dict[str, Any], key: str
    ) -> dict[str, Any]:
        self.validate_id(appointment_id)
        payload = booking.Cancel.model_validate(body).model_dump(
            mode="json", exclude_none=True
        )
        return await self.request(
            "POST",
            f"patients/me/appointments/{appointment_id}/cancel",
            body=payload,
            key=key,
        )

    @staticmethod
    def validate_id(value: int) -> None:
        if type(value) is not int or value <= 0:
            raise ValueError("Invalid appointment identifier")
