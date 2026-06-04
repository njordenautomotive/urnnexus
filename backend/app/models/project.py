from __future__ import annotations

from datetime import datetime
from pathlib import Path

from pydantic import Field

from .common import ApiModel


class ProjectReport(ApiModel):
    report_name: str
    report_path: Path
    report_type: str
    modified_at: datetime
    size_bytes: int
    is_latest: bool = False


class ProjectSummary(ApiModel):
    project_name: str
    project_path: Path
    last_analyzed_at: datetime | None = None
    status: str
    file_count: int = 0
    report_count: int = 0
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


class ProjectAnalysisInfo(ApiModel):
    status: str
    last_analyzed_at: datetime | None = None
    provider: str | None = None
    model: str | None = None
    documents_seen: int | None = None
    chunks_created: int | None = None
    report_items_count: int | None = None
    output_docx_path: Path | None = None
    run_summary_path: Path | None = None
    warnings_count: int = 0
    errors_count: int = 0


class ProjectDetailResponse(ProjectSummary):
    analysis: ProjectAnalysisInfo | None = None
    reports: list[ProjectReport] = Field(default_factory=list)


class ProjectListResponse(ApiModel):
    count: int
    projects: list[ProjectSummary] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class ProjectReportsResponse(ApiModel):
    project_name: str
    project_path: Path
    count: int
    reports: list[ProjectReport] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)

