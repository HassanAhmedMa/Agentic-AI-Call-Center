"""Exercise actual SMTP delivery into local Mailpit; never prints OTPs/tokens."""

import argparse
import json
import re
import time
import urllib.request
from uuid import uuid4


def get(url):
    with urllib.request.urlopen(url, timeout=6) as response:
        return json.load(response)


BASE_URL = "http://localhost:8000"
MAILPIT_URL = "http://localhost:8025"


def post(path, body, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["X-Conversation-Token"] = token
    request = urllib.request.Request(
        BASE_URL + "/api/v1/" + path,
        data=json.dumps(body).encode(),
        headers=headers,
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=6) as response:
        return json.load(response)


def main():
    global BASE_URL, MAILPIT_URL
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default=BASE_URL)
    parser.add_argument("--mailpit-url", default=MAILPIT_URL)
    args = parser.parse_args()
    BASE_URL = args.base_url.rstrip("/")
    MAILPIT_URL = args.mailpit_url.rstrip("/")
    recipient = "smtp-smoke-" + uuid4().hex + "@example.com"
    token = post("conversations", {"channel": "text"})["conversation_token"]
    post(
        "registrations",
        {
            "full_name": "Synthetic SMTP Patient",
            "email": recipient,
            "phone": "+201012345678",
            "date_of_birth": "1988-04-15",
            "preferred_language": "en",
            "privacy_notice_accepted": True,
        },
        token,
    )
    message = None
    for _ in range(30):
        messages = get(MAILPIT_URL + "/api/v1/messages")["messages"]
        for candidate in messages:
            if any(item["Address"] == recipient for item in candidate["To"]):
                message = get(MAILPIT_URL + "/api/v1/message/" + candidate["ID"])
                break
        if message:
            break
        time.sleep(0.2)
    assert message is not None, "No Mailpit verification email delivered"
    code = re.search(r"\b[0-9]{6}\b", message["Text"]).group()
    verified = post(
        "verification/verify", {"purpose": "registration", "code": code}, token
    )
    assert verified["state"] == "verified" and len(verified["customer_number"]) == 6
    print("SMTP/Mailpit registration smoke passed; no code/token printed.")


if __name__ == "__main__":
    main()
