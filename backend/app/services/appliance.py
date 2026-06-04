from __future__ import annotations

import json
import logging
import os
import re
import sqlite3
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable
from zoneinfo import ZoneInfo

from backend.app.config import ApplianceSettings
from backend.app.models.common import CountFacet
from backend.app.models.files import ProjectFileFilters, ProjectFileNode, ProjectFilesResponse
from backend.app.models.health import HealthResponse
from backend.app.models.project import (
    ProjectAnalysisInfo,
    ProjectDetailResponse,
    ProjectListResponse,
    ProjectReport,
    ProjectReportsResponse,
    ProjectSummary,
)

logger = logging.getLogger(__name__)

OSLO_TIMEZONE = ZoneInfo("Europe/Oslo")
LIGHTWEIGHT_STATE_DB_FILENAME = "onedrive_lightweight_state.sqlite3"
REPORT_SUFFIXES = {".docx", ".pdf"}
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
class StateProjectRecord:
    project_name: str
    project_path: Path
    status: str
    last_analyzed_at: datetime | None
    updated_at: datetime | None
    report_path: Path | None
    report_url: str | None
    warnings: list[str] = field(default_factory=list)


@dataclass(slots=True)
class ProjectRecord:
    project_name: str
    project_path: Path
    status: str
    last_analyzed_at: datetime | None
    file_count: int
    report_count: int
    analysis: ProjectAnalysisInfo | None
    reports: list[ProjectReport]
    file_tree: ProjectFileNode
    filters: ProjectFileFilters
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    sort_timestamp: datetime | None = None


def _normalize_name(value: str) -> str:
    return value.strip().casefold()


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
        reports, warnings, errors = self._load_reports(record.project_path)
        return ProjectReportsResponse(
            project_name=record.project_name,
            project_path=record.project_path,
            count=len(reports),
            reports=reports,
            warnings=warnings or record.warnings,
            errors=errors or record.errors,
        )

    def list_files(self, project_name: str) -> ProjectFilesResponse:
        record = self._get_project_record(project_name, load_reports=False)
        source_files, warnings, errors = self._scan_source_files(record.project_path)
        tree = self._build_file_tree(record.project_name, source_files)
        filters = self._build_file_filters(source_files)
        return ProjectFilesResponse(
            project_name=record.project_name,
            project_path=record.project_path,
            total_files=len(source_files),
            file_tree=tree,
            filters=filters,
            warnings=record.warnings + warnings,
            errors=record.errors + errors,
        )

    def discover_projects(self) -> list[ProjectRecord]:
        appliance_root = self.settings.resolved_appliance_root()
        if not appliance_root.exists() or not appliance_root.is_dir():
            return []

        candidates: dict[str, ProjectRecord] = {}
        for record in self._discover_state_projects():
            self._insert_candidate(candidates, record)
        for record in self._discover_sample_projects():
            self._insert_candidate(candidates, record)

        return sorted(
            candidates.values(),
            key=lambda record: (
                record.sort_timestamp or datetime.min.replace(tzinfo=timezone.utc),
                record.project_name.casefold(),
            ),
            reverse=True,
        )

    def _collect_global_warnings(self, records: Iterable[ProjectRecord]) -> list[str]:
        warnings: list[str] = []
        for record in records:
            for warning in record.warnings:
                if warning not in warnings:
                    warnings.append(warning)
        return warnings

    def _insert_candidate(self, candidates: dict[str, ProjectRecord], record: ProjectRecord) -> None:
        key = _normalize_name(record.project_name)
        existing = candidates.get(key)
        if existing is None:
            candidates[key] = record
            return
        if record.sort_timestamp is not None and existing.sort_timestamp is None:
            candidates[key] = record
            return
        if record.sort_timestamp is None and existing.sort_timestamp is not None:
            return
        if record.sort_timestamp is not None and existing.sort_timestamp is not None:
            if record.sort_timestamp > existing.sort_timestamp:
                candidates[key] = record
                return
            if record.sort_timestamp < existing.sort_timestamp:
                return
        if record.project_path.as_posix() < existing.project_path.as_posix():
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
        analysis = record.analysis
        last_analyzed_at = record.last_analyzed_at
        status = record.status
        sort_timestamp = record.sort_timestamp

        if load_reports:
            reports, report_warnings, report_errors = self._load_reports(record.project_path)
            warnings.extend(report_warnings)
            errors.extend(report_errors)
            report_count = len(reports)

        if load_files:
            source_files, file_warnings, file_errors = self._scan_source_files(record.project_path)
            warnings.extend(file_warnings)
            errors.extend(file_errors)
            file_tree = self._build_file_tree(record.project_name, source_files)
            filters = self._build_file_filters(source_files)
            file_count = len(source_files)

        summary_analysis = self._load_analysis_metadata(record.project_path, state_status=status)
        if summary_analysis is not None:
            analysis = summary_analysis
            if summary_analysis.last_analyzed_at is not None:
                last_analyzed_at = summary_analysis.last_analyzed_at
                sort_timestamp = summary_analysis.last_analyzed_at
            status = summary_analysis.status

        return ProjectRecord(
            project_name=record.project_name,
            project_path=record.project_path,
            status=status,
            last_analyzed_at=last_analyzed_at,
            file_count=file_count,
            report_count=report_count,
            analysis=analysis,
            reports=reports,
            file_tree=file_tree,
            filters=filters,
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
            rows = connection.execute(
                "SELECT project_name, local_project_root, analysis_status, last_analyzed_at, updated_at, report_path, report_url FROM projects"
            ).fetchall()
        except Exception as exc:
            logger.warning("Unable to read runtime state database %s: %s", database_path, exc)
            connection.close()
            return records

        for row in rows:
            project_name = str(row["project_name"] or "").strip()
            local_project_root = str(row["local_project_root"] or "").strip()
            if not project_name or not local_project_root:
                continue

            project_path = Path(local_project_root).expanduser()
            analysis_status = str(row["analysis_status"] or "").strip() or "unknown"
            last_analyzed_at = _parse_datetime(str(row["last_analyzed_at"] or "").strip())
            updated_at = _parse_datetime(str(row["updated_at"] or "").strip())
            report_path_value = str(row["report_path"] or "").strip()
            report_url = str(row["report_url"] or "").strip() or None
            report_path = Path(report_path_value).expanduser() if report_path_value else None
            warnings: list[str] = []
            if not project_path.exists():
                warnings.append(f"Project root is missing on disk: {project_path}")

            record = self._build_project_record(
                project_path,
                source="state_db",
                explicit_project_name=project_name,
                explicit_status=analysis_status,
                explicit_last_analyzed_at=last_analyzed_at,
                explicit_sort_timestamp=updated_at or last_analyzed_at,
                explicit_report_path=report_path,
                explicit_report_url=report_url,
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
        explicit_status: str | None = None,
        explicit_last_analyzed_at: datetime | None = None,
        explicit_sort_timestamp: datetime | None = None,
        explicit_report_path: Path | None = None,
        explicit_report_url: str | None = None,
        extra_warnings: list[str] | None = None,
    ) -> ProjectRecord:
        project_path = project_path.expanduser().resolve(strict=False)
        warnings = list(extra_warnings or [])
        errors: list[str] = []
        project_name = explicit_project_name or project_path.name

        analysis = self._load_analysis_metadata(project_path, state_status=explicit_status)
        if analysis is not None:
            status = analysis.status
            last_analyzed_at = analysis.last_analyzed_at or explicit_last_analyzed_at
            sort_timestamp = analysis.last_analyzed_at or explicit_sort_timestamp or explicit_last_analyzed_at
        else:
            status = explicit_status or "unknown"
            last_analyzed_at = explicit_last_analyzed_at
            sort_timestamp = explicit_sort_timestamp or explicit_last_analyzed_at

        reports, report_warnings, report_errors = self._load_reports(project_path)
        warnings.extend(report_warnings)
        errors.extend(report_errors)

        source_files, file_warnings, file_errors = self._scan_source_files(project_path)
        warnings.extend(file_warnings)
        errors.extend(file_errors)

        # If the state database references a report that is not currently in the
        # comments folder, keep the on-disk listing authoritative but log the hint.
        if explicit_report_path is not None and not explicit_report_path.exists():
            warnings.append(f"Referenced report path is missing on disk: {explicit_report_path}")
        if explicit_report_url:
            warnings.append(f"Remote report URL recorded in appliance state: {explicit_report_url}")

        return ProjectRecord(
            project_name=project_name,
            project_path=project_path,
            status=status,
            last_analyzed_at=last_analyzed_at,
            file_count=len(source_files),
            report_count=len(reports),
            analysis=analysis,
            reports=reports,
            file_tree=self._build_file_tree(project_name, source_files),
            filters=self._build_file_filters(source_files),
            warnings=self._dedupe_messages(warnings),
            errors=self._dedupe_messages(errors),
            sort_timestamp=sort_timestamp,
        )

    def _load_analysis_metadata(self, project_path: Path, *, state_status: str | None = None) -> ProjectAnalysisInfo | None:
        project_path = project_path.expanduser().resolve(strict=False)
        summary_path = project_path / "Kommentarer" / "run_summary.json"
        if summary_path.exists():
            try:
                payload = json.loads(summary_path.read_text(encoding="utf-8"))
            except Exception as exc:
                logger.warning("Unable to read run summary %s: %s", summary_path, exc)
                return ProjectAnalysisInfo(
                    status=state_status or "unknown",
                    run_summary_path=summary_path,
                    warnings_count=0,
                    errors_count=0,
                )

            finished_at = _parse_datetime(str(payload.get("finished_at", "") or ""))
            started_at = _parse_datetime(str(payload.get("started_at", "") or ""))
            last_analyzed_at = finished_at or started_at
            warnings = payload.get("warnings") if isinstance(payload.get("warnings"), list) else []
            errors = payload.get("errors") if isinstance(payload.get("errors"), list) else []
            output_docx_path_value = str(payload.get("output_docx_path", "") or "").strip()
            output_docx_path = Path(output_docx_path_value).expanduser() if output_docx_path_value else None

            return ProjectAnalysisInfo(
                status=str(payload.get("status") or state_status or "unknown"),
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

        if state_status is not None:
            return ProjectAnalysisInfo(status=state_status)
        return None

    def _load_reports(self, project_path: Path) -> tuple[list[ProjectReport], list[str], list[str]]:
        project_path = project_path.expanduser().resolve(strict=False)
        warnings: list[str] = []
        errors: list[str] = []
        kommentarer = project_path / "Kommentarer"
        if not kommentarer.exists() or not kommentarer.is_dir():
            return [], warnings, errors

        reports: list[ProjectReport] = []
        for candidate in sorted(kommentarer.rglob("*"), key=lambda item: item.as_posix().casefold()):
            if not candidate.is_file():
                continue
            if candidate.name.casefold() == "run_summary.json":
                continue
            if candidate.suffix.lower() not in REPORT_SUFFIXES:
                continue
            try:
                stat_result = candidate.stat()
            except Exception as exc:
                warning = f"Unable to inspect report file {candidate.relative_to(project_path).as_posix()}: {exc}"
                logger.warning(warning)
                warnings.append(warning)
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

        reports.sort(key=lambda item: (item.modified_at, item.report_name.casefold()), reverse=True)
        if reports:
            reports[0] = reports[0].model_copy(update={"is_latest": True})
        return reports, warnings, errors

    def _scan_source_files(self, project_path: Path) -> tuple[list[SourceFileRecord], list[str], list[str]]:
        project_path = project_path.expanduser().resolve(strict=False)
        if not project_path.exists() or not project_path.is_dir():
            warning = f"Project root is missing or not a directory: {project_path}"
            return [], [warning], [warning]

        source_files: list[SourceFileRecord] = []
        warnings: list[str] = []
        errors: list[str] = []
        project_root_resolved = project_path.resolve(strict=False)

        for dirpath, dirnames, filenames in os.walk(project_path):
            current_dir = Path(dirpath)
            filtered_dirnames: list[str] = []
            for dirname in dirnames:
                candidate = current_dir / dirname
                if _is_ignored_name(dirname):
                    continue
                if dirname.casefold() == "kommentarer":
                    continue
                if candidate.is_symlink():
                    continue
                filtered_dirnames.append(dirname)
            dirnames[:] = filtered_dirnames

            if any(part.casefold() == "kommentarer" for part in current_dir.relative_to(project_root_resolved).parts):
                continue

            for filename in filenames:
                if _is_ignored_name(filename):
                    continue
                file_path = current_dir / filename
                if any(part.casefold() == "kommentarer" for part in file_path.relative_to(project_root_resolved).parts):
                    continue
                try:
                    if file_path.is_symlink():
                        continue
                    resolved_path = file_path.resolve(strict=True)
                    if not resolved_path.is_relative_to(project_root_resolved):
                        continue
                    stat_result = resolved_path.stat()
                except Exception as exc:
                    warning = f"File '{file_path.relative_to(project_path).as_posix()}': {exc.__class__.__name__}: {exc}"
                    logger.warning(warning)
                    warnings.append(warning)
                    errors.append(warning)
                    continue

                relative_path = resolved_path.relative_to(project_path).as_posix()
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
        return source_files, warnings, errors

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
