"""Exercise public availability on an explicitly selected development backend."""

import argparse
import json
from datetime import datetime, timedelta
from urllib.request import urlopen
from zoneinfo import ZoneInfo


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost:8000")
    args = parser.parse_args()
    today = datetime.now(ZoneInfo("Africa/Cairo")).date()
    start = today.isoformat()
    end = (today + timedelta(days=6)).isoformat()
    paths = [
        f"/api/v1/doctors/1/availability?from_date={start}&to_date={end}",
        f"/api/v1/availability/search?from_date={start}&to_date={end}&limit=5",
    ]
    payloads = []
    for path in paths:
        with urlopen(args.base_url.rstrip("/") + path, timeout=10) as response:
            assert response.status == 200
            payloads.append(json.load(response))
    assert len(payloads[0]["days"]) == 7
    assert payloads[0]["slot_minutes"] == 30
    results = payloads[1]["results"]
    assert results, "Synthetic catalog should offer a slot during the next week"
    assert all(row["doctor"]["name_en"] and row["doctor"]["name_ar"] for row in results)
    print("Availability and bilingual earliest-slot search smoke passed.")


if __name__ == "__main__":
    main()
