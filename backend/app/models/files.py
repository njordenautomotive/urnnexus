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
    project_name: str
    project_path: Path
    total_files: int
    file_tree: ProjectFileNode
    filters: ProjectFileFilters
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


ProjectFileNode.model_rebuild()

