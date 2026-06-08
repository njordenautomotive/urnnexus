from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import Field

from .common import ApiModel


class ProjectCreateRequest(ApiModel):
    project_name: str
    template: str | None = None
    folders: list[str] = Field(default_factory=list)


class ProjectCreateResponse(ApiModel):
    project_name: str
    relative_project_path: str
    mode: Literal["onedrive"]
    folders_created: list[str] = Field(default_factory=list)
    warning: str | None = None


class ProjectLocalCacheDeleteResponse(ApiModel):
    project_name: str
    hidden: bool = True
    removed_paths: list[str] = Field(default_factory=list)
    removed_state_rows: int = 0
    message: str = "Dette fjerner prosjektet fra Nexus-visningen og lokal cache. Det sletter ikke prosjektet i OneDrive."


class ProjectDeleteResponse(ApiModel):
    project_name: str
    deleted_remote_path: str
    synced: bool = True
    message: str = "Prosjektet ble slettet i OneDrive og fjernet fra Nexus."


class FileUploadResponse(ApiModel):
    project_name: str
    filename: str
    target_folder: str
    relative_path: str
    size_bytes: int
    mode: Literal["onedrive", "local_cache_only"]
    warning: str | None = None


class FolderCreateRequest(ApiModel):
    folder_name: str
    target_folder: str | None = None


class FolderCreateResponse(ApiModel):
    project_name: str
    folder_name: str
    target_folder: str
    relative_path: str
    mode: Literal["onedrive", "local_cache_only"]
    warning: str | None = None


class SyncRunResponse(ApiModel):
    job_id: str
    running: bool
    started_at: datetime
    status: str
    sync_only: bool = True
    analysis_started: bool = False
    reports_generated: int = 0
    projects_synced: int = 0
    files_changed: int = 0
    reports_found: int = 0


class SyncStatusResponse(ApiModel):
    running: bool
    job_id: str | None = None
    last_started_at: datetime | None = None
    last_completed_at: datetime | None = None
    last_error: str | None = None
    projects_synced: int = 0
    files_changed: int = 0
    reports_found: int = 0
    status: str = "idle"
