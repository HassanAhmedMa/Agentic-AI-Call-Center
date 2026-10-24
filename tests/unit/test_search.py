import pytest
from clinic_backend.search import normalize_search


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("  CARDIOLOGY  ", "cardiology"),
        ("أَطْفَال", "اطفال"),
        ("إستشاري الـقلب", "استشاري القلب"),
        ("دكتور   بَاطنة", "دكتور باطنه"),
        ("عظام / Orthopedics", "عظام / orthopedics"),
        ("١٢٣", "123"),
        ("على", "علي"),
    ],
)
def test_normalizes_english_and_egyptian_arabic(value: str, expected: str) -> None:
    assert normalize_search(value) == expected
