"""WebSocket Connection and Broadcast Manager for Real-Time Multi-Operator Sync.

Provides asynchronous, non-blocking broadcast capabilities for clinic operations
including patient mutations, appointment changes, and live call streaming events.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger("clinic_backend.websocket")


class ConnectionManager:
    """Tracks active operator WebSocket connections and broadcasts real-time events."""

    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, *, accepted: bool = False) -> None:
        """Accept and register an active WebSocket client."""
        if not accepted:
            await websocket.accept()
        async with self._lock:
            self.active_connections.append(websocket)
        logger.info(
            "WebSocket client connected. Active connections: %d",
            len(self.active_connections),
        )

    async def disconnect(self, websocket: WebSocket) -> None:
        """Remove a disconnected WebSocket client."""
        async with self._lock:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)
        logger.info(
            "WebSocket client disconnected. Remaining connections: %d",
            len(self.active_connections),
        )

    async def broadcast(
        self, event_type: str, data: dict[str, Any] | None = None
    ) -> None:
        """Broadcast a structured JSON event to all connected operator dashboards.

        Implements the Thin Event pattern: payloads include entity identifiers and event
        type, allowing clients to fetch fresh data via authenticated REST endpoints.
        """
        payload = {
            "event": event_type,
            "data": data or {},
            "timestamp": datetime.now(UTC).isoformat(),
        }

        async with self._lock:
            targets = list(self.active_connections)

        if not targets:
            return

        dead_connections: list[WebSocket] = []
        for socket in targets:
            try:
                await socket.send_json(payload)
            except Exception as exc:
                logger.debug("Failed sending to WebSocket client: %s", exc)
                dead_connections.append(socket)

        if dead_connections:
            async with self._lock:
                for socket in dead_connections:
                    if socket in self.active_connections:
                        self.active_connections.remove(socket)


# Central singleton instance used across API handlers
ws_manager = ConnectionManager()
