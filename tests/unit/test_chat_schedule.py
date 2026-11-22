from clinic_backend.ai_agent.schedule import conflicts, rank_slots


def test_overlap_and_adjacent_boundary():
    appointments = [
        {
            "id": 3,
            "date": "2026-12-01",
            "start_time": "14:00",
            "end_time": "14:30",
            "status": "scheduled",
        }
    ]
    assert conflicts("2026-12-01", "14:00", "14:30", appointments)
    assert not conflicts("2026-12-01", "14:30", "15:00", appointments)
    assert not conflicts("2026-12-01", "14:00", "14:30", appointments, exclude_id=3)


def test_best_slot_prefers_immediately_after_existing_appointment():
    appointments = [
        {
            "id": 3,
            "date": "2026-12-01",
            "start_time": "14:00",
            "end_time": "14:30",
            "status": "scheduled",
        }
    ]
    slots = [
        {"date": "2026-12-01", "start_time": time}
        for time in ["10:00", "14:00", "14:30", "15:30"]
    ]
    ranked = rank_slots(slots, appointments)
    assert [s["start_time"] for s in ranked] == ["14:30", "15:30", "10:00"]


def test_cancelled_appointments_do_not_block():
    appointments = [
        {
            "id": 3,
            "date": "2026-12-01",
            "start_time": "14:00",
            "end_time": "14:30",
            "status": "cancelled",
        }
    ]
    assert not conflicts("2026-12-01", "14:00", "14:30", appointments)


def test_best_time_accepts_adjacent_before_and_after():
    appointments = [
        {
            "id": 1,
            "date": "2026-11-25",
            "start_time": "10:00",
            "end_time": "10:30",
            "status": "scheduled",
        }
    ]
    slots = [
        {"date": "2026-11-25", "start_time": time}
        for time in ["09:00", "09:30", "10:00", "10:30", "11:00"]
    ]
    assert [x["start_time"] for x in rank_slots(slots, appointments)][:2] == [
        "09:30",
        "10:30",
    ]
