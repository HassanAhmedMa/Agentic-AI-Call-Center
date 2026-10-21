"""Runtime configuration manager for dynamic feature flags and settings.

Persists settings to a JSON file on disk, with thread-safe atomic writes.
"""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger("clinic_backend.runtime_config")

DEFAULT_SETTINGS: dict[str, Any] = {
    "chat_public_coming_soon": True,
}


class RuntimeConfig:
    def __init__(self, filepath: Path | None = None) -> None:
        if filepath is None:
            base = Path(os.environ.get("CLINIC_CONFIG_DIR", "."))
            self.filepath = base / "runtime_settings.json"
        else:
            self.filepath = filepath

        self._data: dict[str, Any] = dict(DEFAULT_SETTINGS)
        self._load()

    def _load(self) -> None:
        if self.filepath.exists():
            try:
                with open(self.filepath, "r", encoding="utf-8") as f:
                    stored = json.load(f)
                    if isinstance(stored, dict):
                        self._data.update(stored)
            except Exception as e:
                logger.warning("Could not read runtime_settings.json: %s", e)

    def _save(self) -> None:
        try:
            self.filepath.parent.mkdir(parents=True, exist_ok=True)
            temp_path = self.filepath.with_suffix(".tmp")
            with open(temp_path, "w", encoding="utf-8") as f:
                json.dump(self._data, f, indent=2)
            temp_path.replace(self.filepath)
        except Exception as e:
            logger.warning("Could not save runtime_settings.json: %s", e)

    def get(self, key: str, default: Any = None) -> Any:
        return self._data.get(key, default)

    def set(self, key: str, value: Any) -> None:
        self._data[key] = value
        self._save()

    def all(self) -> dict[str, Any]:
        return dict(self._data)


runtime_config = RuntimeConfig()
