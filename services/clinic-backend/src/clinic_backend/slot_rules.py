from collections.abc import Collection, Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from clinic_schemas.availability import SlotDay

CAIRO = ZoneInfo("Africa/Cairo")


@dataclass(frozen=True)
class Schedule:
    working_days: tuple[int, ...]
    start: time
    end: time


@dataclass(frozen=True)
class TimeOff:
    start: time | None = None
    end: time | None = None


def slot_instant(day: date, clock: time) -> datetime:
    local = datetime.combine(day, clock)
    instants = set()
    for fold in (0, 1):
        instant = local.replace(tzinfo=CAIRO, fold=fold).astimezone(UTC)
        if instant.astimezone(CAIRO).replace(tzinfo=None) == local:
            instants.add(instant)
    if len(instants) != 1:
        raise ValueError("Nonexistent or ambiguous Cairo local time")
    return instants.pop()


def generate_day(
    schedule: Schedule,
    day: date,
    now: datetime,
    *,
    lead_minutes: int = 60,
    horizon_days: int = 30,
    closure: bool = False,
    time_off: Sequence[TimeOff] = (),
    occupied: Collection[time] = (),
) -> SlotDay:
    if now.tzinfo is None:
        raise ValueError("Clock must be timezone aware")
    if closure or day.isoweekday() == 5:
        return SlotDay(date=day, slots=[], closed=True, reason="CLINIC_CLOSED")
    if day.isoweekday() not in schedule.working_days or any(
        item.start is None for item in time_off
    ):
        return SlotDay(date=day, slots=[], closed=True, reason="DOCTOR_UNAVAILABLE")
    starts = []
    cursor = datetime.combine(day, schedule.start)
    end = datetime.combine(day, schedule.end)
    while cursor + timedelta(minutes=30) <= end:
        stop = (cursor + timedelta(minutes=30)).time()
        start = cursor.time()
        if not any(
            item.start is not None
            and item.end is not None
            and start < item.end
            and stop > item.start
            for item in time_off
        ):
            starts.append(start)
        cursor += timedelta(minutes=30)
    if not starts:
        return SlotDay(date=day, slots=[], closed=True, reason="DOCTOR_UNAVAILABLE")
    lower = now.astimezone(UTC) + timedelta(minutes=lead_minutes)
    upper = now.astimezone(UTC) + timedelta(days=horizon_days)
    candidates = [
        start for start in starts if lower <= slot_instant(day, start) <= upper
    ]
    if not candidates:
        return SlotDay(date=day, slots=[], reason="OUTSIDE_BOOKING_WINDOW")
    available = [
        start.strftime("%H:%M") for start in candidates if start not in occupied
    ]
    return SlotDay(
        date=day, slots=available, reason=None if available else "FULLY_BOOKED"
    )
