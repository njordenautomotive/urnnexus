from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Literal

from pydantic import Field

from .common import ApiModel, CountFacet


class ProjectFileNode(ApiModel):
    name: str
    path: str
    kind: Literal["folder", "file"]
    file_count: int = 0
    folder_category: str | None = None
    extension: str | None = None
    size_bytes: int | None = None
    modified_at: datetime | None = None
    children: list["ProjectFileNode"] = Field(default_factory=list)


class ProjectFileFilters(ApiModel):
    folder_categories: list[CountFacet] = Field(default_factory=list)
    extensions: list[CountFacet] = Field(default_factory=list)


class ProjectFilesResponse(ApiModel):
    display_name: str
    source_label: str = "OneDrive"
    relative_project_path: str
    hidden_internal_path: Path
    last_synced_at: datetime | None = None
    latest_comment_document: str | None = None
    latest_comment_modified_at: datetime | None = None
    comment_document_count: int = 0
    is_sample_project: bool = False
    project_name: str
    project_path: Path
    total_files: int
    file_tree: ProjectFileNode
    filters: ProjectFileFilters
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


ProjectFileNode.model_rebuild()
