import subprocess
from pathlib import Path

from scripts.validate_repo import REQUIRED_FILES, validate_repository


def make_repo(tmp_path: Path) -> Path:
    subprocess.run(["git", "init", "-q", str(tmp_path)], check=True)
    for relative in REQUIRED_FILES:
        file = tmp_path / relative
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text("", encoding="utf-8")
    (tmp_path / ".gitignore").write_text(".venv/\n.env\n", encoding="utf-8")
    return tmp_path


def test_ignored_vendor_certificates_and_local_env_are_allowed(tmp_path: Path) -> None:
    root = make_repo(tmp_path)
    cert = root / ".venv/certifi/cacert.pem"
    cert.parent.mkdir(parents=True)
    cert.write_text("public CA bundle", encoding="utf-8")
    (root / ".env").write_text("LOCAL_ONLY=example", encoding="utf-8")
    assert validate_repository(root)


def test_unignored_private_key_is_rejected(tmp_path: Path) -> None:
    root = make_repo(tmp_path)
    (root / "private.key").write_text("synthetic fixture", encoding="utf-8")
    assert not validate_repository(root)


def test_force_tracked_ignored_env_is_rejected(tmp_path: Path) -> None:
    root = make_repo(tmp_path)
    (root / ".env").write_text("SYNTHETIC=fixture", encoding="utf-8")
    subprocess.run(["git", "-C", str(root), "add", "-f", ".env"], check=True)
    assert not validate_repository(root)
