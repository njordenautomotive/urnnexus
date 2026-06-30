from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import Field

from .common import ApiModel

ActivityState = Literal["Klar", "Starter", "Synkroniserer", "Analyserer", "Genererer rapport", "Sender e-post", "Feilet"]
ActivityLevel = Literal["INFO", "SUCCESS", "WARNING", "ERROR"]


class ActivityStatusResponse(ApiModel):
    state: ActivityState
    activity: str | None = None
    status: str | None = None
    project_name: str | None = None
    uptime: str
    uptime_seconds: float
    backend_version: str | None = None
    appliance_available: bool = False
    last_synced_at: datetime | None = None
    last_analyzed_at: datetime | None = None
    updated_at: datetime


class ActivityEvent(ApiModel):
    timestamp: datetime
    level: ActivityLevel
    project_name: str | None = None
    component: str | None = None
    message: str


class ActivityError(ApiModel):
    timestamp: datetime
    project_name: str | None = None
    component: str | None = None
    message: str


class ActivityEventsResponse(ApiModel):
    updated_at: datetime
    events: list[ActivityEvent] = Field(default_factory=list)
    errors: list[ActivityError] = Field(default_factory=list)


class ActivityLogEntry(ApiModel):
    timestamp: datetime
    level: ActivityLevel
    project_name: str | None = None
    component: str | None = None
    message: str


class ActivityLogsResponse(ApiModel):
    updated_at: datetime
    entries: list[ActivityLogEntry] = Field(default_factory=list)
