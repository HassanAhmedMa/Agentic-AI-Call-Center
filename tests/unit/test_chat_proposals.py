import pytest
from clinic_backend.chat_proposals import issue, verify


def test_proposal_is_bound_immutable_and_expires():
    body = {"doctor_id": 7, "date": "2026-11-22", "start_time": "09:30"}
    token = issue(body, "conversation", "synthetic-secret", now=1000)
    assert verify(token, "conversation", "synthetic-secret", now=1200) == body
    with pytest.raises(ValueError):
        verify(token, "other", "synthetic-secret", now=1200)
    with pytest.raises(ValueError):
        verify(token, "conversation", "synthetic-secret", now=1300)
    with pytest.raises(ValueError):
        verify(token + "tampered", "conversation", "synthetic-secret", now=1200)
