import shutil
import subprocess
from pathlib import Path

import pytest


def test_registration_logout_and_profile_repair_state():
    node = shutil.which("node")
    if node is None:
        bundled = (
            Path.home()
            / ".cache/codex-runtimes/codex-primary-runtime"
            / "dependencies/node/bin/node.exe"
        )
        node = str(bundled) if bundled.exists() else None
    if node is None:
        pytest.skip("Node.js required for browser state unit tests")
    result = subprocess.run(
        [node, str(Path(__file__).with_name("registration_state.cjs"))],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr
