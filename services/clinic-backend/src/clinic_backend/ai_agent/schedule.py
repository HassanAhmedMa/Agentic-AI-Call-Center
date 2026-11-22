("Deterministic patient calendar checks and recommendatio" "ns, not reservations.")

from datetime import datetime, timedelta
from typing import Any


def minutes(value: str) -> int:
    parsed = datetime.strptime(value, "%H:%M")
    return parsed.hour * 60 + parsed.minute


def conflicts(
    day: str,
    start: str,
    end: str,
    appointments: list[dict[str, Any]],
    *,
    exclude_id: int | None = None,
) -> list[dict[str, Any]]:
    return [
        a
        for a in appointments
        if a["status"] == "scheduled"
        and a["date"] == day
        and a["id"] != exclude_id
        and minutes(start) < minutes(a["end_time"])
        and minutes(end) > minutes(a["start_time"])
    ]


def rank_slots(
    slots: list[dict[str, Any]],
    appointments: list[dict[str, Any]],
    *,
    exclude_id: int | None = None,
) -> list[dict[str, Any]]:
    (
        "Prefer after the final visit that day; otherwise earlie"
        "st free slot.\n\n    Callers must fetch the complete pati"
        "ent schedule and live doctor availability.\n    Final mu"
        "tation must revalidate availability under the booking t"
        "ransaction.\n    "
    )
    candidates = []
    for slot in slots:
        start = slot["start_time"]
        end = (datetime.strptime(start, "%H:%M") + timedelta(minutes=30)).strftime(
            "%H:%M"
        )
        if not conflicts(slot["date"], start, end, appointments, exclude_id=exclude_id):
            candidates.append(slot)

    def score(slot: dict[str, Any]) -> tuple[str, int, int]:
        visits = [
            a
            for a in appointments
            if a["status"] == "scheduled"
            and a["date"] == slot["date"]
            and a["id"] != exclude_id
        ]
        start = minutes(slot["start_time"])
        gaps = []
        for visit in visits:
            if start >= minutes(visit["end_time"]):
                gaps.append(start - minutes(visit["end_time"]))
            elif start + 30 <= minutes(visit["start_time"]):
                gaps.append(minutes(visit["start_time"]) - start - 30)
        return slot["date"], min(gaps) if gaps else 100000, start

    return sorted(candidates, key=score)
