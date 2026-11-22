import shutil
import subprocess
from pathlib import Path

import pytest


def test_admin_client_credentials_and_patient_prefix():
    node = shutil.which("node")
    if node is None:
        bundled = (
            Path.home()
            / ".cache/codex-runtimes/codex-primary-runtime"
            / "dependencies/node/bin/node.exe"
        )
        node = str(bundled) if bundled.exists() else None
    if node is None:
        pytest.skip("Node.js required for admin client tests")
    result = subprocess.run(
        [node, str(Path(__file__).with_name("admin_client.cjs"))],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr
