"""Read-only patient tools over authenticated clinic APIs."""

from datetime import datetime, timedelta
from typing import Any

from clinic_schemas.availability import AvailabilityQuery
from pydantic import BaseModel, ConfigDict, Field

from clinic_backend.ai_agent.appointments import AppointmentAPI
from clinic_backend.ai_agent.schedule import conflicts, rank_slots


class SlotCheck(BaseModel):
    model_config = ConfigDict(extra="forbid")
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    start_time: str = Field(pattern=r"^(?:[01][0-9]|2[0-3]):(?:00|30)$")


class AvailabilityInput(AvailabilityQuery):
    doctor_id: int = Field(gt=0)


class Empty(BaseModel):
    model_config = ConfigDict(extra="forbid")


INPUTS: dict[str, type[BaseModel]] = {
    "get_patient_context": Empty,
    "list_my_appointments": Empty,
    "get_doctor_availability": AvailabilityInput,
    "check_slot_conflict": SlotCheck,
    "recommend_best_slot": AvailabilityInput,
}


def schemas() -> list[dict[str, Any]]:
    descriptions = {
        "get_patient_context": "Read verified first name and language.",
        "list_my_appointments": "Read my scheduled appointments.",
        "get_doctor_availability": "Read live doctor slots for a date range.",
        "check_slot_conflict": "Check overlap with my appointments.",
        "recommend_best_slot": (
            "Rank live slots nearest before or after my visits, mini"
            "mizing gaps; does not book."
        ),
    }
    return [
        {
            "type": "function",
            "function": {
                "name": name,
                "description": descriptions[name],
                "parameters": model.model_json_schema(),
            },
        }
        for name, model in INPUTS.items()
    ]


async def execute(
    api: AppointmentAPI, name: str, arguments: dict[str, Any]
) -> dict[str, Any]:
    body = INPUTS[name].model_validate(arguments)
    if name == "get_patient_context":
        return await api.patient_context()
    appointments = []
    if name in {"list_my_appointments", "check_slot_conflict", "recommend_best_slot"}:
        offset = 0
        while True:
            page = await api.appointments(
                {
                    "status": "scheduled",
                    "upcoming_only": True,
                    "limit": 100,
                    "offset": offset,
                }
            )
            appointments.extend(page["appointments"])
            offset += len(page["appointments"])
            if offset >= page["total"]:
                break
            if not page["appointments"] or offset > 1000:
                raise ValueError("Patient schedule could not be loaded completely")
        # Never expose patient identifiers or visit reasons to the model.
        appointments = [
            {
                key: item[key]
                for key in ("id", "date", "start_time", "end_time", "status", "doctor")
            }
            for item in appointments
        ]
    if name == "list_my_appointments":
        return {"appointments": appointments}
    if name == "check_slot_conflict":
        values = body.model_dump()
        end = (
            datetime.strptime(values["start_time"], "%H:%M") + timedelta(minutes=30)
        ).strftime("%H:%M")
        overlap = conflicts(values["date"], values["start_time"], end, appointments)
        return {"conflict": bool(overlap), "appointments": overlap}
    values = body.model_dump(mode="json")
    doctor = values.pop("doctor_id")
    available = await api.availability(doctor, values)
    if name == "get_doctor_availability":
        return available
    slots = [
        {"date": day["date"], "start_time": slot}
        for day in available["days"]
        for slot in day["slots"]
        if not any(
            a["date"] == day["date"] and a["doctor"]["id"] == doctor
            for a in appointments
        )
    ]
    ranked = rank_slots(slots, appointments)
    adjacent = []
    for direction in ("before", "after"):
        for slot in ranked:
            linked = next(
                (
                    a
                    for a in appointments
                    if a["date"] == slot["date"]
                    and (
                        (direction == "after" and slot["start_time"] == a["end_time"])
                        or (
                            direction == "before"
                            and (
                                datetime.strptime(slot["start_time"], "%H:%M")
                                + timedelta(minutes=30)
                            ).strftime("%H:%M")
                            == a["start_time"]
                        )
                    )
                ),
                None,
            )
            if linked:
                adjacent.append(
                    {**slot, "position": direction, "near_doctor": linked["doctor"]}
                )
                break
    return {
        "doctor_id": doctor,
        "slots": ranked[:10],
        "adjacent_slots": adjacent,
        "reserved": False,
    }
