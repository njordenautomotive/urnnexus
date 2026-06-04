from __future__ import annotations

from pathlib import Path

from .common import ApiModel


class HealthResponse(ApiModel):
    appliance_available: bool
    uptime_seconds: float
    uptime: str
    version: str | None = None
    appliance_root: Path
    discovered_projects: int = 0

