"""Signed, expiring immutable proposals bound to the verified conversation."""

import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Any


def issue(
    body: dict[str, Any], conversation: str, secret: str, now: float | None = None
) -> str:
    data = {
        "body": body,
        "conversation": hashlib.sha256(conversation.encode()).hexdigest(),
        "expires": int(now if now is not None else time.time()) + 300,
        "nonce": secrets.token_hex(16),
    }
    raw = base64.urlsafe_b64encode(json.dumps(data, sort_keys=True).encode()).decode()
    signature = hmac.new(secret.encode(), raw.encode(), hashlib.sha256).hexdigest()
    return raw + "." + signature


def verify(
    token: str, conversation: str, secret: str, now: float | None = None
) -> dict[str, Any]:
    try:
        raw, signature = token.split(".")
        expected = hmac.new(secret.encode(), raw.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError("Invalid proposal")
        data = json.loads(base64.urlsafe_b64decode(raw))
        if data["expires"] <= (now if now is not None else time.time()):
            raise ValueError("Expired proposal")
        if data["conversation"] != hashlib.sha256(conversation.encode()).hexdigest():
            raise ValueError("Wrong conversation")
        return dict(data["body"])
    except (KeyError, TypeError, json.JSONDecodeError, UnicodeError) as error:
        raise ValueError("Invalid proposal") from error
