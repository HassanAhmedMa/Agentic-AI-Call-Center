"""Generate ignored local identity configuration without printing secrets."""

import secrets
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    path = ROOT / ".env"
    lines = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
    values = {}
    for line in lines:
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            values[key] = value
    updates = {"IDENTITY_ENABLED": "true"}
    for name in ["AGENT_SERVICE_TOKEN", "OTP_HMAC_SECRET"]:
        existing = values.get(name, "").strip("'\"")
        if len(existing.encode()) < 32 or existing.startswith("replace-with-"):
            updates[name] = secrets.token_urlsafe(32)
    agent = updates.get("AGENT_SERVICE_TOKEN", values.get("AGENT_SERVICE_TOKEN", ""))
    otp = updates.get("OTP_HMAC_SECRET", values.get("OTP_HMAC_SECRET", ""))
    if agent == otp:
        updates["OTP_HMAC_SECRET"] = secrets.token_urlsafe(32)
    if values.get("SMTP_HOST", "") in {"", "localhost"}:
        updates["SMTP_HOST"] = "mailpit"
        updates["SMTP_PORT"] = "1025"
    lines = [line for line in lines if line.split("=", 1)[0] not in updates]
    lines.extend(f"{key}={value}" for key, value in updates.items())
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(
        "Identity enabled in ignored .env; secrets generated/preserved, not displayed."
    )
    print("Local SMTP uses Mailpit. Start it with: docker compose up -d mailpit")


if __name__ == "__main__":
    main()
