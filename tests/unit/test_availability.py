from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

import pytest
from clinic_backend.slot_rules import Schedule, TimeOff, generate_day, slot_instant
from clinic_schemas.availability import AvailabilityQuery, SearchQuery
from pydantic import ValidationError

DAY = date(2026, 10, 15)
SCHEDULE = Schedule((1, 2, 3, 4, 6, 7), time(10), time(14))


def test_shift_and_time_off():
    now = slot_instant(DAY, time(8))
    result = generate_day(SCHEDULE, DAY, now, time_off=[TimeOff(time(12), time(13))])
    assert result.slots == ["10:00", "10:30", "11:00", "11:30", "13:00", "13:30"]
    assert generate_day(SCHEDULE, date(2026, 10, 16), now).reason == "CLINIC_CLOSED"
    assert (
        generate_day(SCHEDULE, DAY, now, time_off=[TimeOff()]).reason
        == "DOCTOR_UNAVAILABLE"
    )


def test_exact_elapsed_boundaries():
    start = slot_instant(DAY, time(10))
    assert "10:00" in generate_day(SCHEDULE, DAY, start - timedelta(hours=1)).slots
    assert (
        "10:00"
        not in generate_day(
            SCHEDULE, DAY, start - timedelta(hours=1) + timedelta(microseconds=1)
        ).slots
    )
    assert generate_day(SCHEDULE, DAY, start - timedelta(days=30)).slots == ["10:00"]
    assert (
        generate_day(SCHEDULE, DAY, start - timedelta(days=30, microseconds=1)).slots
        == []
    )


def test_empty_reason_precedence():
    now = slot_instant(DAY, time(8))
    occupied = {time(h, m) for h in range(10, 14) for m in (0, 30)}
    assert generate_day(SCHEDULE, DAY, now, occupied=occupied).reason == "FULLY_BOOKED"
    assert (
        generate_day(
            SCHEDULE,
            DAY,
            now,
            occupied=occupied,
            time_off=[TimeOff(time(12), time(13))],
        ).reason
        == "FULLY_BOOKED"
    )
    assert (
        generate_day(SCHEDULE, DAY, now + timedelta(days=40)).reason
        == "OUTSIDE_BOOKING_WINDOW"
    )


def test_cairo_clock_change_and_invalid_local_times():
    assert slot_instant(date(2026, 10, 29), time(10)) == datetime(
        2026, 10, 29, 7, tzinfo=UTC
    )
    assert slot_instant(date(2026, 10, 31), time(10)) == datetime(
        2026, 10, 31, 8, tzinfo=UTC
    )
    for day, clock in [
        (date(2026, 4, 24), time(0, 30)),
        (date(2026, 10, 29), time(23, 30)),
    ]:
        with pytest.raises(ValueError):
            slot_instant(day, clock)


def test_query_validation():
    assert AvailabilityQuery(
        from_date="2026-10-15", to_date="2026-10-21"
    ).to_date == date(2026, 10, 21)
    assert SearchQuery(
        from_date="2026-10-15", earliest_time="10:15"
    ).earliest_time == time(10, 15)
    for values in [
        dict(from_date="2026-10-15", to_date="2026-10-22"),
        dict(from_date="2026-10-15", to_date="2026-10-14"),
        dict(from_date="20261015"),
        dict(from_date="9999-12-31", to_date="10000-01-01"),
        dict(from_date="2026-10-15", earliest_time="10:00:00"),
        dict(from_date="2026-10-15", doctor_id=0),
        dict(from_date="2026-10-15", earliest_time="12:00", latest_time="11:00"),
    ]:
        with pytest.raises(ValidationError):
            SearchQuery(**values)


def test_horizon_crosses_cairo_clock_change_as_elapsed_time():
    day = date(2026, 10, 31)
    start = slot_instant(day, time(10))
    now = start - timedelta(days=30)
    assert now.astimezone(ZoneInfo("Africa/Cairo")).hour == 11
    assert generate_day(SCHEDULE, day, now).slots == ["10:00"]
    assert generate_day(SCHEDULE, day, now - timedelta(microseconds=1)).slots == []
