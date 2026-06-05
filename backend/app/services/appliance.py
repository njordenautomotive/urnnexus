from __future__ import annotations

import json
import logging
import re
import sqlite3
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import quote
from zoneinfo import ZoneInfo

from backend.app.config import ApplianceSettings
from backend.app.models.common import CountFacet
from backend.app.models.files import ProjectFileFilters, ProjectFileNode, ProjectFilesResponse
from backend.app.models.health import HealthResponse
from backend.app.models.project import (
    ProjectAnalysisInfo,
    ProjectDebugPathCandidate,
    ProjectDebugPathsResponse,
    ProjectDetailResponse,
    ProjectListResponse,
    ProjectReport,
    ProjectReportsResponse,
    ProjectSummary,
)

logger = logging.getLogger(__name__)

OSLO_TIMEZONE = ZoneInfo("Europe/Oslo")
LIGHTWEIGHT_STATE_DB_FILENAME = "onedrive_lightweight_state.sqlite3"
REPORT_SUFFIXES = {".docx"}
OPENABLE_REPORT_SUFFIXES = {".docx", ".pdf"}
COMMENT_ROOT_NAMES = {"kommentarer", "enterprise_review"}
DISPLAY_PATH_PREFIX = "AnbudAppliance/"
SOURCE_CATEGORY_LABELS: dict[str, str] = {
    "background_documents": "Bakgrunnsdokumenter",
    "tender": "Anbud",
    "drawings": "Tegninger",
    "previous_communication": "Tidligere kommunikasjon",
    "comments": "Kommentarer",
    "other": "Andre filer",
}
SOURCE_CATEGORY_BY_FOLDER: dict[str, str] = {
    "bakgrunnsdokumenter": "background_documents",
    "anbud": "tender",
    "tegninger": "drawings",
    "tidligere kommunikasjon": "previous_communication",
    "kommentarer": "comments",
}
_VERSION_RE = re.compile(r"^\s*version\s*=\s*[\"']([^\"']+)[\"']", re.MULTILINE)


class ApplianceServiceError(RuntimeError):
    """Base error for read-only appliance access failures."""


class ApplianceUnavailableError(ApplianceServiceError):
    """Raised when the appliance root is missing."""


class ProjectNotFoundError(ApplianceServiceError):
    """Raised when a project cannot be matched."""


class ProjectAmbiguousError(ApplianceServiceError):
    """Raised when multiple projects match the same requested name."""


class ProjectReportNotFoundError(ApplianceServiceError):
    """Raised when a project report cannot be opened safely."""


@dataclass(slots=True)
class SourceFileRecord:
    relative_path: str
    absolute_path: Path
    folder_category: str
    size_bytes: int
    modified_at: datetime

    @property
    def extension(self) -> str:
        return self.absolute_path.suffix.lower()


@dataclass(slots=True)
class SourceScanResult:
    source_files: list[SourceFileRecord]
    total_files_on_disk: int
    ignored_file_count: int
    ignored_reasons: list[str]
    first_20_files_on_disk: list[str]
    warnings: list[str]
    errors: list[str]
    source_inventory_mode: str = "filesystem"
    filesystem_total_files_on_disk: int = 0
    state_total_files_on_disk: int = 0
    state_path: Path | None = None


@dataclass(slots=True)
class StateProjectRecord:
    project_name: str
    project_path: Path
    remote_root_path: str | None
    source_label: str
    status: str
    last_synced_at: datetime | None
    last_analyzed_at: datetime | None
    updated_at: datetime | None
    report_path: Path | None
    report_url: str | None
    warnings: list[str] = field(default_factory=list)


@dataclass(slots=True)
class ProjectRecord:
    project_name: str
    display_name: str
    source_label: str
    relative_project_path: str
    hidden_internal_path: Path
    state_path: Path | None
    last_synced_at: datetime | None
    latest_comment_document: str | None
    latest_comment_document_open_url: str | None
    latest_comment_modified_at: datetime | None
    comment_document_count: int
    is_sample_project: bool
    project_path: Path
    status: str
    last_analyzed_at: datetime | None
    file_count: int
    report_count: int
    analysis: ProjectAnalysisInfo | None
    reports: list[ProjectReport]
    file_tree: ProjectFileNode
    filters: ProjectFileFilters
    source_scan: SourceScanResult | None = None
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    sort_timestamp: datetime | None = None


def _normalize_name(value: str) -> str:
    return value.strip().casefold()


def _display_relative_project_path(value: str) -> str:
    text = str(value or "").strip().replace("\\", "/")
    if text.casefold().startswith(DISPLAY_PATH_PREFIX.casefold()):
        return text[len(DISPLAY_PATH_PREFIX) :]
    return text


def _parse_datetime(value: str | None) -> datetime | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text)
    except Exception:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc).astimezone(OSLO_TIMEZONE)
    return parsed.astimezone(OSLO_TIMEZONE)


def _parse_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default


def _row_value(row: sqlite3.Row, key: str, default: Any = None) -> Any:
    try:
        keys = row.keys()
    except Exception:
        return default
    if key not in keys:
        return default
    try:
        value = row[key]
    except Exception:
        return default
    if value is None:
        return default
    return value


def _select_analysis_status(payload_status: str | None, state_status: str | None) -> str:
    state_clean = (state_status or "").strip()
    payload_clean = (payload_status or "").strip()

    if state_clean and state_clean.casefold() not in {"unknown", "success", "ok"}:
        return state_clean
    if payload_clean:
        if payload_clean.casefold() in {"success", "ok"}:
            return state_clean or "completed"
        return payload_clean
    if state_clean:
        return state_clean
    return "unknown"


def _project_folder_category(relative_path: Path) -> str:
    if not relative_path.parts:
        return "other"
    first_segment = relative_path.parts[0].strip().casefold()
    return SOURCE_CATEGORY_BY_FOLDER.get(first_segment, "other")


def _is_ignored_name(name: str) -> bool:
    lowered = name.casefold().strip()
    if not lowered:
        return True
    if lowered.startswith("."):
        return True
    if lowered.startswith("~$"):
        return True
    return lowered in {"thumbs.db"}


def _source_file_ignore_reason_from_relative(relative_path: Path) -> str | None:
    if not relative_path.parts:
        return "Unreadable files are excluded from source file counts."

    if any(part.casefold() == "kommentarer" for part in relative_path.parts):
        return "Kommentarer folders are excluded from source file counts."

    if any(_is_ignored_name(part) for part in relative_path.parts[:-1]):
        return "Hidden or temporary directories are excluded from source file counts."

    if _is_ignored_name(relative_path.name):
        return "Hidden or temporary files are excluded from source file counts."

    return None


def _infer_sync_state_path(project_path: Path) -> Path | None:
    resolved = project_path.expanduser().resolve(strict=False)
    parts = resolved.parts
    for index in range(len(parts) - 2):
        if parts[index].casefold() == "cache" and parts[index + 1].casefold() == "onedrive_sync":
            if len(parts) - index < 4:
                return None
            state_parts = list(parts[:index]) + ["state", "onedrive_sync"] + list(parts[index + 2 : -1])
            return Path(*state_parts) / "sync_state.json"
    return None


def _is_project_root_candidate(path: Path) -> bool:
    if not path.exists() or not path.is_dir():
        return False

    markers = (
        "Anbud",
        "Bakgrunnsdokumenter",
        "Tegninger",
        "Tidligere kommunikasjon",
        "Kommentarer",
        ".riveanbud_state",
        ".riveanbud_cache",
    )
    for marker in markers:
        if (path / marker).exists():
            return True
    kommentarer = path / "Kommentarer"
    if kommentarer.exists() and any(child.suffix.lower() == ".docx" for child in kommentarer.rglob("*") if child.is_file()):
        return True
    return False


def _sort_comment_documents_key(report: ProjectReport) -> tuple[int, datetime, str]:
    priority = 1 if "kommentardokument" in report.report_name.casefold() else 0
    return priority, report.modified_at, report.report_name.casefold()


class ApplianceService:
    def __init__(self, settings: ApplianceSettings, *, started_at: datetime | None = None) -> None:
        self.settings = settings
        self.started_at = started_at or datetime.now(timezone.utc)

    def health(self) -> HealthResponse:
        appliance_root = self.settings.resolved_appliance_root()
        available = appliance_root.exists() and appliance_root.is_dir()
        version = self._read_appliance_version(appliance_root) if available else None
        discovered_projects = len(self.discover_projects()) if available else 0
        uptime_seconds = max(0.0, (datetime.now(timezone.utc) - self.started_at).total_seconds())
        return HealthResponse(
            appliance_available=available,
            uptime_seconds=uptime_seconds,
            uptime=str(timedelta(seconds=uptime_seconds)),
            version=version,
            appliance_root=appliance_root,
            discovered_projects=discovered_projects,
        )

    def list_projects(self) -> ProjectListResponse:
        records = self.discover_projects()
        projects = [
            ProjectSummary(
                display_name=record.display_name,
                source_label=record.source_label,
                relative_project_path=record.relative_project_path,
                hidden_internal_path=record.hidden_internal_path,
                last_synced_at=record.last_synced_at,
                latest_comment_document=record.latest_comment_document,
                latest_comment_document_open_url=record.latest_comment_document_open_url,
                latest_comment_modified_at=record.latest_comment_modified_at,
                comment_document_count=record.comment_document_count,
                is_sample_project=record.is_sample_project,
                project_name=record.project_name,
                project_path=record.project_path,
                last_analyzed_at=record.last_analyzed_at,
                status=record.status,
                file_count=record.file_count,
                report_count=record.report_count,
                warnings=record.warnings,
                errors=record.errors,
            )
            for record in records
        ]
        warnings = self._collect_global_warnings(records)
        return ProjectListResponse(count=len(projects), projects=projects, warnings=warnings)

    def get_project(self, project_name: str) -> ProjectDetailResponse:
        record = self._get_project_record(project_name)
        return ProjectDetailResponse(
            display_name=record.display_name,
            source_label=record.source_label,
            relative_project_path=record.relative_project_path,
            hidden_internal_path=record.hidden_internal_path,
            last_synced_at=record.last_synced_at,
            latest_comment_document=record.latest_comment_document,
            latest_comment_document_open_url=record.latest_comment_document_open_url,
            latest_comment_modified_at=record.latest_comment_modified_at,
            comment_document_count=record.comment_document_count,
            is_sample_project=record.is_sample_project,
            project_name=record.project_name,
            project_path=record.project_path,
            last_analyzed_at=record.last_analyzed_at,
            status=record.status,
            file_count=record.file_count,
            report_count=record.report_count,
            warnings=record.warnings,
            errors=record.errors,
            analysis=record.analysis,
            reports=record.reports,
        )

    def list_reports(self, project_name: str) -> ProjectReportsResponse:
        record = self._get_project_record(project_name, load_files=False)
        reports, warnings, errors = self._load_reports(
            record.project_path,
            project_name=record.project_name,
            relative_project_path=record.relative_project_path,
            is_sample_project=record.is_sample_project,
        )
        return ProjectReportsResponse(
            display_name=record.display_name,
            source_label=record.source_label,
            relative_project_path=record.relative_project_path,
            hidden_internal_path=record.hidden_internal_path,
            last_synced_at=record.last_synced_at,
            latest_comment_document=record.latest_comment_document,
            latest_comment_document_open_url=record.latest_comment_document_open_url,
            latest_comment_modified_at=record.latest_comment_modified_at,
            comment_document_count=record.comment_document_count,
            is_sample_project=record.is_sample_project,
            project_name=record.project_name,
            project_path=record.project_path,
            count=len(reports),
            reports=reports,
            warnings=warnings or record.warnings,
            errors=errors or record.errors,
        )

    def open_report(self, project_name: str, report_id: str) -> ProjectReport:
        record = self._get_project_record(project_name, load_files=False)
        report = self._select_report(record.reports, report_id)
        report_path = report.report_path.expanduser().resolve(strict=True)

        if report_path.suffix.lower() not in OPENABLE_REPORT_SUFFIXES:
            raise ProjectReportNotFoundError(f"Report not found: {report_id}")

        allowed_roots = self._allowed_report_roots(record)
        if not allowed_roots or not any(report_path.is_relative_to(root) for root in allowed_roots):
            raise ProjectReportNotFoundError(f"Report not found: {report_id}")

        return report.model_copy(update={"report_path": report_path})

    def list_files(self, project_name: str) -> ProjectFilesResponse:
        record = self._get_project_record(project_name, load_reports=False)
        source_files, warnings, errors = self._scan_source_files(record.project_path, state_path=record.state_path)
        tree = self._build_file_tree(record.project_name, source_files)
        filters = self._build_file_filters(source_files)
        return ProjectFilesResponse(
            display_name=record.display_name,
            source_label=record.source_label,
            relative_project_path=record.relative_project_path,
            hidden_internal_path=record.hidden_internal_path,
            last_synced_at=record.last_synced_at,
            latest_comment_document=record.latest_comment_document,
            latest_comment_document_open_url=record.latest_comment_document_open_url,
            latest_comment_modified_at=record.latest_comment_modified_at,
            comment_document_count=record.comment_document_count,
            is_sample_project=record.is_sample_project,
            project_name=record.project_name,
            project_path=record.project_path,
            total_files=len(source_files),
            file_tree=tree,
            filters=filters,
            warnings=record.warnings + warnings,
            errors=record.errors + errors,
        )

    def debug_paths(self, project_name: str) -> ProjectDebugPathsResponse:
        normalized = _normalize_name(project_name)
        candidates = [
            record
            for record in self._discover_project_candidates()
            if _normalize_name(record.project_name) == normalized
        ]
        if not candidates:
            raise ProjectNotFoundError(f"Project not found: {project_name}")

        selected = self._select_best_candidate(candidates)
        selected_inspection = selected.source_scan or self._inspect_source_files(selected.project_path, state_path=selected.state_path)
        selected_reports, _, _ = self._load_reports(
            selected.project_path,
            project_name=selected.project_name,
            relative_project_path=selected.relative_project_path,
            is_sample_project=selected.is_sample_project,
        )

        debug_candidates: list[ProjectDebugPathCandidate] = []
        for candidate in sorted(candidates, key=self._project_selection_key, reverse=True):
            inspection = candidate.source_scan or self._inspect_source_files(candidate.project_path, state_path=candidate.state_path)
            reports, _, _ = self._load_reports(
                candidate.project_path,
                project_name=candidate.project_name,
                relative_project_path=candidate.relative_project_path,
                is_sample_project=candidate.is_sample_project,
            )
            debug_candidates.append(
                ProjectDebugPathCandidate(
                    candidate_path=candidate.hidden_internal_path,
                    source_file_count=len(inspection.source_files),
                    report_count=len(reports),
                    comment_document_count=candidate.comment_document_count,
                    source_inventory_mode=inspection.source_inventory_mode,
                    is_sample_project=candidate.is_sample_project,
                    selected=candidate.project_path == selected.project_path,
                    latest_comment_document=candidate.latest_comment_document,
                    latest_comment_modified_at=candidate.latest_comment_modified_at,
                )
            )

        ignored_reasons = list(selected_inspection.ignored_reasons)
        if not selected_inspection.source_files and selected_reports:
            ignored_note = "Only comment documents were found for this project; no source files were counted."
            if ignored_note not in ignored_reasons:
                ignored_reasons.append(ignored_note)

        return ProjectDebugPathsResponse(
            project_name=selected.project_name,
            resolved_project_path=selected.hidden_internal_path,
            project_path_exists=selected.hidden_internal_path.exists() and selected.hidden_internal_path.is_dir(),
            total_files_on_disk=selected_inspection.total_files_on_disk,
            counted_source_files=len(selected_inspection.source_files),
            comment_documents_found=len(selected_reports),
            first_20_files_on_disk=selected_inspection.first_20_files_on_disk,
            ignored_file_count=selected_inspection.ignored_file_count,
            ignored_reasons=self._dedupe_messages(ignored_reasons),
            candidates=debug_candidates,
        )

    def discover_projects(self) -> list[ProjectRecord]:
        appliance_root = self.settings.resolved_appliance_root()
        if not appliance_root.exists() or not appliance_root.is_dir():
            return []

        candidates: dict[str, ProjectRecord] = {}
        for record in self._discover_project_candidates():
            self._insert_candidate(candidates, record)

        return sorted(
            candidates.values(),
            key=lambda record: (
                record.sort_timestamp or datetime.min.replace(tzinfo=timezone.utc),
                record.project_name.casefold(),
            ),
            reverse=True,
        )

    def _discover_project_candidates(self) -> list[ProjectRecord]:
        records: list[ProjectRecord] = []
        records.extend(self._discover_state_projects())
        records.extend(self._discover_sample_projects())
        return records

    def _collect_global_warnings(self, records: Iterable[ProjectRecord]) -> list[str]:
        warnings: list[str] = []
        for record in records:
            for warning in record.warnings:
                if warning not in warnings:
                    warnings.append(warning)
        return warnings

    def _project_selection_key(self, record: ProjectRecord) -> tuple[int, int, datetime, int, str]:
        timestamp = record.sort_timestamp or datetime.min.replace(tzinfo=timezone.utc)
        inventory_score = 1 if record.source_scan is not None and record.source_scan.source_inventory_mode == "filesystem" else 0
        return (
            0 if record.is_sample_project else 1,
            record.file_count,
            timestamp,
            inventory_score,
            record.project_path.as_posix(),
        )

    def _select_best_candidate(self, records: list[ProjectRecord]) -> ProjectRecord:
        return sorted(records, key=self._project_selection_key, reverse=True)[0]

    def _insert_candidate(self, candidates: dict[str, ProjectRecord], record: ProjectRecord) -> None:
        key = _normalize_name(record.project_name)
        existing = candidates.get(key)
        if existing is None:
            candidates[key] = record
            return
        if self._project_selection_key(record) > self._project_selection_key(existing):
            candidates[key] = record

    def _get_project_record(self, project_name: str, *, load_files: bool = True, load_reports: bool = True) -> ProjectRecord:
        normalized = _normalize_name(project_name)
        matches = [record for record in self.discover_projects() if _normalize_name(record.project_name) == normalized]
        if not matches:
            raise ProjectNotFoundError(f"Project not found: {project_name}")
        if len(matches) > 1:
            raise ProjectAmbiguousError(f"Project name matches multiple projects: {project_name}")

        record = matches[0]
        if load_files or load_reports:
            updated = self._refresh_project_details(record, load_files=load_files, load_reports=load_reports)
            return updated
        return record

    def _refresh_project_details(self, record: ProjectRecord, *, load_files: bool, load_reports: bool) -> ProjectRecord:
        warnings = list(record.warnings)
        errors = list(record.errors)
        reports = record.reports
        file_tree = record.file_tree
        filters = record.filters
        file_count = record.file_count
        report_count = record.report_count
        comment_document_count = record.comment_document_count
        analysis = record.analysis
        last_analyzed_at = record.last_analyzed_at
        status = record.status
        sort_timestamp = record.sort_timestamp

        if load_reports:
            reports, report_warnings, report_errors = self._load_reports(
                record.project_path,
                project_name=record.project_name,
                relative_project_path=record.relative_project_path,
                is_sample_project=record.is_sample_project,
            )
            warnings.extend(report_warnings)
            errors.extend(report_errors)
            report_count = len(reports)
            comment_document_count = len(reports)

        if load_files:
            source_inspection = self._inspect_source_files(record.project_path, state_path=record.state_path)
            source_files = source_inspection.source_files
            warnings.extend(source_inspection.warnings)
            errors.extend(source_inspection.errors)
            file_tree = self._build_file_tree(record.project_name, source_files)
            filters = self._build_file_filters(source_files)
            file_count = len(source_files)
            record_scan = source_inspection
        else:
            record_scan = record.source_scan

        summary_analysis = self._load_analysis_metadata(
            record.project_path,
            state_status=status,
            relative_project_path=record.relative_project_path,
            is_sample_project=record.is_sample_project,
        )
        if summary_analysis is not None:
            analysis = summary_analysis
            if summary_analysis.last_analyzed_at is not None:
                last_analyzed_at = summary_analysis.last_analyzed_at
                sort_timestamp = summary_analysis.last_analyzed_at
            status = summary_analysis.status

        latest_comment_document = record.latest_comment_document
        latest_comment_document_open_url = record.latest_comment_document_open_url
        latest_comment_modified_at = record.latest_comment_modified_at
        if load_reports:
            latest_comment_document = reports[0].report_name if reports else latest_comment_document
            latest_comment_document_open_url = self._report_open_url(record.project_name, "latest") if reports else latest_comment_document_open_url
            latest_comment_modified_at = reports[0].modified_at if reports else latest_comment_modified_at

        return ProjectRecord(
            project_name=record.project_name,
            display_name=record.display_name,
            source_label=record.source_label,
            relative_project_path=record.relative_project_path,
            hidden_internal_path=record.hidden_internal_path,
            state_path=record.state_path,
            last_synced_at=record.last_synced_at,
            latest_comment_document=latest_comment_document,
            latest_comment_document_open_url=latest_comment_document_open_url,
            latest_comment_modified_at=latest_comment_modified_at,
            comment_document_count=comment_document_count,
            is_sample_project=record.is_sample_project,
            project_path=record.project_path,
            status=status,
            last_analyzed_at=last_analyzed_at,
            file_count=file_count,
            report_count=report_count,
            analysis=analysis,
            reports=reports,
            file_tree=file_tree,
            filters=filters,
            source_scan=record_scan,
            warnings=self._dedupe_messages(warnings),
            errors=self._dedupe_messages(errors),
            sort_timestamp=sort_timestamp,
        )

    def _discover_sample_projects(self) -> list[ProjectRecord]:
        sample_root = self.settings.sample_projects_root()
        if not sample_root.exists() or not sample_root.is_dir():
            return []

        records: list[ProjectRecord] = []
        for candidate in sorted(sample_root.iterdir(), key=lambda item: item.name.casefold()):
            if not candidate.is_dir():
                continue
            records.extend(self._collect_project_roots(candidate))
        return records

    def _collect_project_roots(self, candidate: Path) -> list[ProjectRecord]:
        if _is_project_root_candidate(candidate):
            return [self._build_project_record(candidate, source="sample_project")]

        records: list[ProjectRecord] = []
        try:
            children = sorted((child for child in candidate.iterdir() if child.is_dir()), key=lambda item: item.name.casefold())
        except Exception as exc:
            logger.warning("Unable to inspect sample project container %s: %s", candidate, exc)
            return records

        for child in children:
            records.extend(self._collect_project_roots(child))
        return records

    def _discover_state_projects(self) -> list[ProjectRecord]:
        records: list[ProjectRecord] = []
        for runtime_root in self.settings.runtime_roots():
            if not runtime_root.exists() or not runtime_root.is_dir():
                continue
            for database_path in runtime_root.rglob(LIGHTWEIGHT_STATE_DB_FILENAME):
                records.extend(self._load_state_db_projects(database_path))
        return records

    def _load_state_db_projects(self, database_path: Path) -> list[ProjectRecord]:
        records: list[ProjectRecord] = []
        try:
            connection = sqlite3.connect(database_path)
            connection.row_factory = sqlite3.Row
        except Exception as exc:
            logger.warning("Unable to open runtime state database %s: %s", database_path, exc)
            return records

        try:
            rows = connection.execute("SELECT * FROM projects").fetchall()
        except Exception as exc:
            logger.warning("Unable to read runtime state database %s: %s", database_path, exc)
            connection.close()
            return records

        for row in rows:
            project_name = str(_row_value(row, "project_name", "") or "").strip()
            remote_root_path = str(_row_value(row, "remote_root_path", "") or "").strip()
            local_project_root = str(_row_value(row, "local_project_root", "") or "").strip()
            if not project_name or not local_project_root:
                continue

            project_path = Path(local_project_root).expanduser()
            analysis_status = str(_row_value(row, "analysis_status", "") or "").strip() or "unknown"
            last_synced_at = _parse_datetime(str(_row_value(row, "last_sync_at", "") or "").strip())
            last_analyzed_at = _parse_datetime(str(_row_value(row, "last_analyzed_at", "") or "").strip())
            updated_at = _parse_datetime(str(_row_value(row, "updated_at", "") or "").strip())
            report_path_value = str(_row_value(row, "report_path", "") or "").strip()
            report_url = str(_row_value(row, "report_url", "") or "").strip() or None
            report_path = Path(report_path_value).expanduser() if report_path_value else None
            state_path_text = str(_row_value(row, "state_path", "") or "").strip()
            state_path = Path(state_path_text).expanduser() if state_path_text else _infer_sync_state_path(project_path)
            warnings: list[str] = []
            if not project_path.exists():
                logger.warning("Project root is missing on disk: %s", project_path)
                warnings.append("Project root is missing on disk.")

            record = self._build_project_record(
                project_path,
                source="state_db",
                explicit_project_name=project_name,
                explicit_relative_project_path=remote_root_path or None,
                explicit_last_synced_at=last_synced_at or updated_at,
                explicit_status=analysis_status,
                explicit_last_analyzed_at=last_analyzed_at,
                explicit_sort_timestamp=updated_at or last_analyzed_at,
                explicit_report_path=report_path,
                explicit_report_url=report_url,
                explicit_state_path=state_path,
                extra_warnings=warnings,
            )
            records.append(record)

        connection.close()
        return records

    def _build_project_record(
        self,
        project_path: Path,
        *,
        source: str,
        explicit_project_name: str | None = None,
        explicit_relative_project_path: str | None = None,
        explicit_last_synced_at: datetime | None = None,
        explicit_status: str | None = None,
        explicit_last_analyzed_at: datetime | None = None,
        explicit_sort_timestamp: datetime | None = None,
        explicit_report_path: Path | None = None,
        explicit_report_url: str | None = None,
        explicit_state_path: Path | None = None,
        extra_warnings: list[str] | None = None,
    ) -> ProjectRecord:
        project_path = project_path.expanduser().resolve(strict=False)
        warnings = list(extra_warnings or [])
        errors: list[str] = []
        project_name = explicit_project_name or project_path.name
        is_sample_project = source == "sample_project"
        display_name = project_name
        source_label = "OneDrive"
        relative_project_path = explicit_relative_project_path or (
            f"sample_projects/{project_name}" if is_sample_project else project_name
        )
        relative_project_path = _display_relative_project_path(relative_project_path)
        state_path = explicit_state_path or _infer_sync_state_path(project_path)

        analysis = self._load_analysis_metadata(
            project_path,
            state_status=explicit_status,
            relative_project_path=relative_project_path,
            is_sample_project=is_sample_project,
        )
        if analysis is not None:
            status = analysis.status
            last_analyzed_at = analysis.last_analyzed_at or explicit_last_analyzed_at
            sort_timestamp = analysis.last_analyzed_at or explicit_sort_timestamp or explicit_last_analyzed_at
        else:
            status = explicit_status or "unknown"
            last_analyzed_at = explicit_last_analyzed_at
            sort_timestamp = explicit_sort_timestamp or explicit_last_analyzed_at

        reports, report_warnings, report_errors = self._load_reports(
            project_path,
            project_name=project_name,
            relative_project_path=relative_project_path,
            is_sample_project=is_sample_project,
        )
        warnings.extend(report_warnings)
        errors.extend(report_errors)
        latest_comment_document = reports[0].report_name if reports else None
        latest_comment_document_open_url = self._report_open_url(project_name, "latest") if reports else None
        latest_comment_modified_at = reports[0].modified_at if reports else None
        comment_document_count = len(reports)

        source_inspection = self._inspect_source_files(project_path, state_path=state_path)
        source_files = source_inspection.source_files
        warnings.extend(source_inspection.warnings)
        errors.extend(source_inspection.errors)

        # If the state database references a report that is not currently in the
        # comments folder, keep the on-disk listing authoritative but log the hint.
        if explicit_report_path is not None and not explicit_report_path.exists():
            logger.warning("Referenced report path is missing on disk: %s", explicit_report_path)
            warnings.append("Referenced report path is missing on disk.")
        if explicit_report_url:
            warnings.append("Remote report URL recorded in appliance state.")

        if explicit_last_synced_at is not None:
            last_synced_at = explicit_last_synced_at
        elif analysis is not None and analysis.last_analyzed_at is not None:
            last_synced_at = analysis.last_analyzed_at
        else:
            last_synced_at = latest_comment_modified_at or sort_timestamp

        if sort_timestamp is None:
            sort_timestamp = last_synced_at or latest_comment_modified_at

        return ProjectRecord(
            project_name=project_name,
            display_name=display_name,
            source_label=source_label,
            relative_project_path=relative_project_path,
            hidden_internal_path=project_path,
            state_path=state_path,
            last_synced_at=last_synced_at,
            latest_comment_document=latest_comment_document,
            latest_comment_document_open_url=latest_comment_document_open_url,
            latest_comment_modified_at=latest_comment_modified_at,
            comment_document_count=comment_document_count,
            is_sample_project=is_sample_project,
            project_path=project_path,
            status=status,
            last_analyzed_at=last_analyzed_at,
            file_count=len(source_files),
            report_count=comment_document_count,
            analysis=analysis,
            reports=reports,
            file_tree=self._build_file_tree(project_name, source_files),
            filters=self._build_file_filters(source_files),
            source_scan=source_inspection,
            warnings=self._dedupe_messages(warnings),
            errors=self._dedupe_messages(errors),
            sort_timestamp=sort_timestamp,
        )

    def _analysis_summary_candidates(
        self,
        project_path: Path,
        *,
        relative_project_path: str | None,
        is_sample_project: bool,
    ) -> list[Path]:
        candidates: list[Path] = []
        seen: set[str] = set()

        def add(path: Path) -> None:
            resolved = path.expanduser().resolve(strict=False)
            key = resolved.as_posix()
            if key in seen or not resolved.exists() or not resolved.is_file():
                return
            seen.add(key)
            candidates.append(resolved)

        for root in self._comment_root_candidates(
            project_path,
            relative_project_path=relative_project_path,
            is_sample_project=is_sample_project,
        ):
            if root.name.casefold() in COMMENT_ROOT_NAMES:
                add(root / "run_summary.json")
                continue

            for summary_path in sorted(root.rglob("run_summary.json"), key=lambda item: item.as_posix().casefold()):
                if summary_path.parent.name.casefold() in COMMENT_ROOT_NAMES:
                    add(summary_path)

        return candidates

    def _load_analysis_metadata(
        self,
        project_path: Path,
        *,
        state_status: str | None = None,
        relative_project_path: str | None = None,
        is_sample_project: bool = False,
    ) -> ProjectAnalysisInfo | None:
        project_path = project_path.expanduser().resolve(strict=False)
        candidate_paths = self._analysis_summary_candidates(
            project_path,
            relative_project_path=relative_project_path,
            is_sample_project=is_sample_project,
        )
        best_info: ProjectAnalysisInfo | None = None
        best_timestamp: datetime | None = None

        for summary_path in candidate_paths:
            try:
                payload = json.loads(summary_path.read_text(encoding="utf-8"))
            except Exception as exc:
                logger.warning("Unable to read run summary %s: %s", summary_path, exc)
                continue

            finished_at = _parse_datetime(str(payload.get("finished_at", "") or ""))
            started_at = _parse_datetime(str(payload.get("started_at", "") or ""))
            last_analyzed_at = finished_at or started_at
            warnings = payload.get("warnings") if isinstance(payload.get("warnings"), list) else []
            errors = payload.get("errors") if isinstance(payload.get("errors"), list) else []
            output_docx_path_value = str(payload.get("output_docx_path", "") or "").strip()
            output_docx_path = Path(output_docx_path_value).expanduser() if output_docx_path_value else None

            info = ProjectAnalysisInfo(
                status=_select_analysis_status(str(payload.get("status") or ""), state_status),
                last_analyzed_at=last_analyzed_at,
                provider=str(payload.get("provider") or "") or None,
                model=str(payload.get("model") or "") or None,
                documents_seen=_parse_int(payload.get("documents_seen"), 0) if payload.get("documents_seen") is not None else None,
                chunks_created=_parse_int(payload.get("chunks_created"), 0) if payload.get("chunks_created") is not None else None,
                report_items_count=_parse_int(payload.get("report_items_count"), 0) if payload.get("report_items_count") is not None else None,
                output_docx_path=output_docx_path,
                run_summary_path=summary_path,
                warnings_count=len(warnings),
                errors_count=len(errors),
            )
            timestamp = last_analyzed_at
            if timestamp is None:
                try:
                    timestamp = datetime.fromtimestamp(summary_path.stat().st_mtime, tz=OSLO_TIMEZONE)
                except Exception:
                    timestamp = None

            if best_info is None:
                best_info = info
                best_timestamp = timestamp
                continue

            if timestamp is not None and (best_timestamp is None or timestamp > best_timestamp):
                best_info = info
                best_timestamp = timestamp

        if best_info is not None:
            return best_info

        if state_status is not None:
            return ProjectAnalysisInfo(status=state_status)
        return None

    def _output_relative_path(self, relative_project_path: str | None) -> Path | None:
        if not relative_project_path:
            return None

        parts = Path(relative_project_path).parts
        if not parts:
            return None
        if parts[0].casefold() == "anbudappliance":
            parts = parts[1:]
        if not parts:
            return None
        return Path(*parts)

    def _comment_root_candidates(self, project_path: Path, *, relative_project_path: str | None, is_sample_project: bool) -> list[Path]:
        candidates: list[Path] = []
        seen: set[str] = set()

        def add(path: Path) -> None:
            resolved = path.expanduser().resolve(strict=False)
            key = resolved.as_posix()
            if key in seen:
                return
            if resolved.exists() and resolved.is_dir():
                candidates.append(resolved)
                seen.add(key)

        add(project_path / "Kommentarer")
        if not is_sample_project:
            output_relative = self._output_relative_path(relative_project_path)
            if output_relative is not None:
                add(self.settings.resolved_appliance_root() / "outputs" / output_relative)
        return candidates

    def _report_search_roots(self, root: Path) -> list[Path]:
        if root.name.casefold() in COMMENT_ROOT_NAMES:
            return [root]
        search_roots: list[Path] = []
        for candidate in sorted(root.rglob("*"), key=lambda item: item.as_posix().casefold()):
            if candidate.is_dir() and candidate.name.casefold() in COMMENT_ROOT_NAMES:
                search_roots.append(candidate)
        return search_roots

    def _allowed_report_roots(self, record: ProjectRecord) -> list[Path]:
        roots: list[Path] = []
        for root in self._comment_root_candidates(
            record.project_path,
            relative_project_path=record.relative_project_path,
            is_sample_project=record.is_sample_project,
        ):
            for report_root in self._report_search_roots(root):
                try:
                    roots.append(report_root.expanduser().resolve(strict=True))
                except Exception as exc:
                    logger.warning("Unable to resolve report root %s: %s", report_root, exc)
        return roots

    def _select_report(self, reports: list[ProjectReport], report_id: str) -> ProjectReport:
        normalized = str(report_id or "").strip().casefold()
        if normalized == "latest":
            index = 0
        elif normalized.isdecimal():
            index = int(normalized)
        else:
            raise ProjectReportNotFoundError(f"Report not found: {report_id}")

        if index < 0 or index >= len(reports):
            raise ProjectReportNotFoundError(f"Report not found: {report_id}")
        return reports[index]

    def _report_open_url(self, project_name: str, report_id: str) -> str:
        return f"/api/projects/{quote(project_name, safe='')}/reports/{quote(report_id, safe='')}/open"

    def _load_reports(
        self,
        project_path: Path,
        *,
        project_name: str,
        relative_project_path: str | None = None,
        is_sample_project: bool = False,
    ) -> tuple[list[ProjectReport], list[str], list[str]]:
        project_path = project_path.expanduser().resolve(strict=False)
        warnings: list[str] = []
        errors: list[str] = []
        reports: list[ProjectReport] = []
        seen_paths: set[str] = set()

        for root in self._comment_root_candidates(
            project_path,
            relative_project_path=relative_project_path,
            is_sample_project=is_sample_project,
        ):
            for comment_root in self._report_search_roots(root):
                for candidate in sorted(comment_root.rglob("*"), key=lambda item: item.as_posix().casefold()):
                    if not candidate.is_file():
                        continue
                    if candidate.name.casefold() == "run_summary.json":
                        continue
                    if candidate.suffix.lower() not in REPORT_SUFFIXES:
                        continue

                    candidate_key = candidate.expanduser().resolve(strict=False).as_posix()
                    if candidate_key in seen_paths:
                        continue
                    seen_paths.add(candidate_key)

                    try:
                        stat_result = candidate.stat()
                    except Exception as exc:
                        relative_candidate = candidate.relative_to(project_path).as_posix() if candidate.is_relative_to(project_path) else candidate.name
                        logger.warning("Unable to inspect report file %s: %s", relative_candidate, exc)
                        warnings.append("Unable to inspect one of the comment documents.")
                        continue

                    reports.append(
                        ProjectReport(
                            report_name=candidate.name,
                            report_path=candidate,
                            report_type=candidate.suffix.lower().lstrip(".") or "unknown",
                            modified_at=datetime.fromtimestamp(stat_result.st_mtime, tz=OSLO_TIMEZONE),
                            size_bytes=stat_result.st_size,
                            is_latest=False,
                        )
                    )

        reports.sort(key=_sort_comment_documents_key, reverse=True)
        reports = [
            report.model_copy(
                update={
                    "report_id": str(index),
                    "is_latest": index == 0,
                    "open_url": self._report_open_url(project_name, str(index)),
                }
            )
            for index, report in enumerate(reports)
        ]
        return reports, warnings, errors

    def _source_file_ignore_reason(self, file_path: Path, project_root_resolved: Path) -> str | None:
        if file_path.is_symlink():
            return "Symlinks are excluded from source file counts."
        try:
            relative_path = file_path.relative_to(project_root_resolved)
        except Exception:
            return "Files outside the resolved project root are excluded from source file counts."

        reason = _source_file_ignore_reason_from_relative(relative_path)
        if reason is not None:
            return reason

        try:
            resolved_path = file_path.resolve(strict=True)
        except Exception:
            return "Unreadable files are excluded from source file counts."

        if not resolved_path.is_relative_to(project_root_resolved):
            return "Files outside the resolved project root are excluded from source file counts."

        return None

    def _inspect_source_files_from_filesystem(self, project_path: Path) -> SourceScanResult:
        project_path = project_path.expanduser().resolve(strict=False)
        if not project_path.exists() or not project_path.is_dir():
            logger.warning("Project root is missing or not a directory: %s", project_path)
            warning = "Project root is missing or not a directory."
            return SourceScanResult(
                source_files=[],
                total_files_on_disk=0,
                ignored_file_count=0,
                ignored_reasons=[warning],
                first_20_files_on_disk=[],
                warnings=[warning],
                errors=[warning],
                source_inventory_mode="filesystem",
                filesystem_total_files_on_disk=0,
                state_total_files_on_disk=0,
            )

        source_files: list[SourceFileRecord] = []
        warnings: list[str] = []
        errors: list[str] = []
        first_20_files_on_disk: list[str] = []
        ignored_reasons: list[str] = []
        total_files_on_disk = 0
        ignored_file_count = 0
        project_root_resolved = project_path.resolve(strict=False)

        for candidate in sorted(project_path.rglob("*"), key=lambda item: item.as_posix().casefold()):
            if not candidate.is_file():
                continue

            total_files_on_disk += 1
            relative_path = candidate.relative_to(project_path).as_posix()
            if len(first_20_files_on_disk) < 20:
                first_20_files_on_disk.append(relative_path)

            reason = self._source_file_ignore_reason(candidate, project_root_resolved)
            if reason is not None:
                ignored_file_count += 1
                if reason not in ignored_reasons:
                    ignored_reasons.append(reason)
                continue

            try:
                resolved_path = candidate.resolve(strict=True)
                stat_result = resolved_path.stat()
            except Exception as exc:
                logger.warning("Unable to inspect file %s: %s", relative_path, exc)
                warnings.append(f"Unable to inspect file '{relative_path}'.")
                errors.append(f"Unable to inspect file '{relative_path}'.")
                ignored_file_count += 1
                if "Unreadable files are excluded from source file counts." not in ignored_reasons:
                    ignored_reasons.append("Unreadable files are excluded from source file counts.")
                continue

            if not resolved_path.is_relative_to(project_root_resolved):
                ignored_file_count += 1
                if "Files outside the resolved project root are excluded from source file counts." not in ignored_reasons:
                    ignored_reasons.append("Files outside the resolved project root are excluded from source file counts.")
                continue

            source_files.append(
                SourceFileRecord(
                    relative_path=relative_path,
                    absolute_path=resolved_path,
                    folder_category=_project_folder_category(Path(relative_path)),
                    size_bytes=stat_result.st_size,
                    modified_at=datetime.fromtimestamp(stat_result.st_mtime, tz=OSLO_TIMEZONE),
                )
            )

        source_files.sort(key=lambda item: item.relative_path.casefold())

        if total_files_on_disk == 0:
            ignored_reasons.append("No source files were found in the local appliance cache.")
        elif not source_files and ignored_file_count == total_files_on_disk and ignored_file_count > 0:
            ignored_reasons.append("Only generated comment documents or cache files were found.")

        deduped_reasons = self._dedupe_messages(ignored_reasons)
        return SourceScanResult(
            source_files=source_files,
            total_files_on_disk=total_files_on_disk,
            ignored_file_count=ignored_file_count,
            ignored_reasons=deduped_reasons,
            first_20_files_on_disk=first_20_files_on_disk,
            warnings=warnings,
            errors=errors,
            source_inventory_mode="filesystem",
            filesystem_total_files_on_disk=total_files_on_disk,
            state_total_files_on_disk=0,
        )

    def _inspect_source_files_from_state(self, project_path: Path, state_path: Path) -> SourceScanResult | None:
        project_path = project_path.expanduser().resolve(strict=False)
        state_path = state_path.expanduser().resolve(strict=False)
        if not state_path.exists() or not state_path.is_file():
            return None

        try:
            payload = json.loads(state_path.read_text(encoding="utf-8"))
        except Exception as exc:
            logger.warning("Unable to read sync state %s: %s", state_path, exc)
            warning = "Unable to read the OneDrive sync state cache."
            return SourceScanResult(
                source_files=[],
                total_files_on_disk=0,
                ignored_file_count=0,
                ignored_reasons=[warning],
                first_20_files_on_disk=[],
                warnings=[warning],
                errors=[warning],
                source_inventory_mode="sync_state",
                filesystem_total_files_on_disk=0,
                state_total_files_on_disk=0,
                state_path=state_path,
            )

        items_by_id = payload.get("items_by_id")
        if not isinstance(items_by_id, dict) or not items_by_id:
            return SourceScanResult(
                source_files=[],
                total_files_on_disk=0,
                ignored_file_count=0,
                ignored_reasons=["No source files were found in the OneDrive sync state."],
                first_20_files_on_disk=[],
                warnings=[],
                errors=[],
                source_inventory_mode="sync_state",
                filesystem_total_files_on_disk=0,
                state_total_files_on_disk=0,
                state_path=state_path,
            )

        source_files: list[SourceFileRecord] = []
        warnings: list[str] = []
        errors: list[str] = []
        first_20_files_on_disk: list[str] = []
        ignored_reasons: list[str] = []
        total_files_on_disk = 0
        ignored_file_count = 0

        ordered_items = sorted(
            (item for item in items_by_id.values() if isinstance(item, dict)),
            key=lambda item: str(item.get("relative_path") or "").casefold(),
        )

        for item in ordered_items:
            if bool(item.get("is_folder")):
                continue

            relative_path_text = str(item.get("relative_path") or "").strip()
            if not relative_path_text:
                continue

            total_files_on_disk += 1
            if len(first_20_files_on_disk) < 20:
                first_20_files_on_disk.append(relative_path_text)

            relative_path = Path(relative_path_text)
            reason = _source_file_ignore_reason_from_relative(relative_path)
            if reason is not None:
                ignored_file_count += 1
                if reason not in ignored_reasons:
                    ignored_reasons.append(reason)
                continue

            local_path_text = str(item.get("local_path") or item.get("local_cache_path") or "").strip()
            absolute_path = Path(local_path_text).expanduser() if local_path_text else project_path / relative_path
            resolved_path = absolute_path.expanduser().resolve(strict=False)
            if not resolved_path.is_relative_to(project_path):
                ignored_file_count += 1
                reason = "Files outside the resolved project root are excluded from source file counts."
                if reason not in ignored_reasons:
                    ignored_reasons.append(reason)
                continue

            size_bytes = _parse_int(item.get("size"), 0)
            modified_at = _parse_datetime(str(item.get("last_modified_date_time") or "").strip())
            if resolved_path.exists():
                try:
                    stat_result = resolved_path.stat()
                    size_bytes = stat_result.st_size
                    modified_at = datetime.fromtimestamp(stat_result.st_mtime, tz=OSLO_TIMEZONE)
                except Exception as exc:
                    logger.warning("Unable to inspect cached source file %s: %s", relative_path_text, exc)
                    warning = f"Unable to inspect file '{relative_path_text}'."
                    warnings.append(warning)
                    errors.append(warning)
                    ignored_file_count += 1
                    if "Unreadable files are excluded from source file counts." not in ignored_reasons:
                        ignored_reasons.append("Unreadable files are excluded from source file counts.")
                    continue

            if modified_at is None:
                modified_at = datetime.fromtimestamp(0, tz=OSLO_TIMEZONE)

            source_files.append(
                SourceFileRecord(
                    relative_path=relative_path_text,
                    absolute_path=resolved_path,
                    folder_category=_project_folder_category(relative_path),
                    size_bytes=size_bytes,
                    modified_at=modified_at,
                )
            )

        source_files.sort(key=lambda item: item.relative_path.casefold())

        if total_files_on_disk == 0:
            ignored_reasons.append("No source files were found in the local appliance cache.")
        elif not source_files and ignored_file_count == total_files_on_disk and ignored_file_count > 0:
            ignored_reasons.append("Only generated comment documents or cache files were found.")

        deduped_reasons = self._dedupe_messages(ignored_reasons)
        return SourceScanResult(
            source_files=source_files,
            total_files_on_disk=total_files_on_disk,
            ignored_file_count=ignored_file_count,
            ignored_reasons=deduped_reasons,
            first_20_files_on_disk=first_20_files_on_disk,
            warnings=warnings,
            errors=errors,
            source_inventory_mode="sync_state",
            filesystem_total_files_on_disk=0,
            state_total_files_on_disk=total_files_on_disk,
            state_path=state_path,
        )

    def _inspect_source_files(self, project_path: Path, *, state_path: Path | None = None) -> SourceScanResult:
        filesystem_inspection = self._inspect_source_files_from_filesystem(project_path)
        inferred_state_path = state_path or _infer_sync_state_path(project_path)
        state_inspection = self._inspect_source_files_from_state(project_path, inferred_state_path) if inferred_state_path is not None else None

        if state_inspection is None:
            filesystem_inspection.state_total_files_on_disk = 0
            filesystem_inspection.state_path = inferred_state_path
            return filesystem_inspection

        filesystem_inspection.state_total_files_on_disk = state_inspection.total_files_on_disk
        filesystem_inspection.state_path = inferred_state_path
        state_inspection.filesystem_total_files_on_disk = filesystem_inspection.total_files_on_disk

        filesystem_count = len(filesystem_inspection.source_files)
        state_count = len(state_inspection.source_files)
        if state_count > filesystem_count:
            state_inspection.filesystem_total_files_on_disk = filesystem_inspection.total_files_on_disk
            return state_inspection

        filesystem_inspection.source_inventory_mode = "filesystem"
        return filesystem_inspection

    def _scan_source_files(self, project_path: Path, *, state_path: Path | None = None) -> tuple[list[SourceFileRecord], list[str], list[str]]:
        inspection = self._inspect_source_files(project_path, state_path=state_path)
        return inspection.source_files, inspection.warnings, inspection.errors

    def _build_file_tree(self, project_name: str, files: list[SourceFileRecord]) -> ProjectFileNode:
        root = ProjectFileNode(name=project_name, path=".", kind="folder")
        folder_nodes: dict[str, ProjectFileNode] = {".": root}

        for source_file in files:
            relative_path = Path(source_file.relative_path)
            parent = root
            accumulated_parts: list[str] = []

            for segment in relative_path.parts[:-1]:
                accumulated_parts.append(segment)
                node_path = "/".join(accumulated_parts)
                if node_path not in folder_nodes:
                    folder_node = ProjectFileNode(
                        name=segment,
                        path=node_path,
                        kind="folder",
                        folder_category=_project_folder_category(Path(node_path)),
                    )
                    folder_nodes[node_path] = folder_node
                    parent.children.append(folder_node)
                parent = folder_nodes[node_path]

            file_node = ProjectFileNode(
                name=relative_path.name,
                path=source_file.relative_path,
                kind="file",
                folder_category=source_file.folder_category,
                extension=source_file.extension,
                size_bytes=source_file.size_bytes,
                modified_at=source_file.modified_at,
                file_count=1,
            )
            parent.children.append(file_node)

        self._finalize_tree_node(root)
        return root

    def _finalize_tree_node(self, node: ProjectFileNode) -> int:
        if node.kind == "file":
            node.file_count = 1
            return 1

        node.children.sort(
            key=lambda child: (
                0 if child.kind == "folder" else 1,
                child.name.casefold(),
            )
        )
        total = 0
        for child in node.children:
            total += self._finalize_tree_node(child)
        node.file_count = total
        return total

    def _build_file_filters(self, files: list[SourceFileRecord]) -> ProjectFileFilters:
        category_counts: Counter[str] = Counter()
        extension_counts: Counter[str] = Counter()
        for file_record in files:
            category_counts[file_record.folder_category] += 1
            extension = file_record.extension or ""
            extension_counts[extension] += 1

        folder_categories = [
            CountFacet(value=value, label=SOURCE_CATEGORY_LABELS[value], count=count)
            for value, count in sorted(category_counts.items(), key=lambda item: (-item[1], item[0]))
        ]
        extensions = [
            CountFacet(value=value or "(no extension)", label=value or "(no extension)", count=count)
            for value, count in sorted(extension_counts.items(), key=lambda item: (-item[1], item[0]))
        ]
        return ProjectFileFilters(folder_categories=folder_categories, extensions=extensions)

    def _dedupe_messages(self, messages: Iterable[str]) -> list[str]:
        deduped: list[str] = []
        seen: set[str] = set()
        for message in messages:
            text = str(message).strip()
            if not text or text in seen:
                continue
            seen.add(text)
            deduped.append(text)
        return deduped

    def _read_appliance_version(self, appliance_root: Path) -> str | None:
        pyproject = appliance_root / "pyproject.toml"
        if not pyproject.exists():
            return None
        try:
            content = pyproject.read_text(encoding="utf-8")
        except Exception as exc:
            logger.warning("Unable to read appliance version from %s: %s", pyproject, exc)
            return None
        match = _VERSION_RE.search(content)
        if match is None:
            return None
        return match.group(1).strip() or None
