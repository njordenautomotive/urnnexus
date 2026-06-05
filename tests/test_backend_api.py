from __future__ import annotations

import asyncio
import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

import pytest
import httpx

from backend.app.config import ApplianceSettings
from backend.app.main import create_app


class _AsyncAppClient:
    def __init__(self, app) -> None:
        self._app = app

    def get(self, path: str) -> httpx.Response:
        async def _request() -> httpx.Response:
            transport = httpx.ASGITransport(app=self._app)
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                return await client.get(path)

        return asyncio.run(_request())


def _client(settings: ApplianceSettings | None = None) -> _AsyncAppClient:
    return _AsyncAppClient(create_app(settings))


def _project_path(name: str) -> str:
    return quote(name, safe="")


def _write_file(path: Path, content: bytes, *, modified_at: datetime | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)
    if modified_at is not None:
        timestamp = modified_at.timestamp()
        os.utime(path, (timestamp, timestamp))


def _build_custom_appliance_root(tmp_path: Path) -> Path:
    appliance_root = tmp_path / "appliance"
    runtime_root = appliance_root / ".riveanbud_runtime" / "rive-anbud-appliance" / "Urban_Reuse_Norway"
    project_root = (
        runtime_root
        / "cache"
        / "onedrive_sync"
        / "test-sync-id"
        / "post@example.com"
        / "test-drive-id"
        / "Alpha Project"
    )
    comments_root = project_root / "Kommentarer"
    outputs_root = appliance_root / "outputs" / "Urban_Reuse_Norway" / "Alpha Project" / "2026-06-02" / "enterprise_review"

    for folder in [
        "Anbud",
        "Bakgrunnsdokumenter",
        "Tegninger",
        "Tidligere kommunikasjon",
        "Kommentarer",
    ]:
        (project_root / folder).mkdir(parents=True, exist_ok=True)

    _write_file(project_root / "Anbud" / "tilbud.txt", b"Alpha tender", modified_at=datetime(2026, 6, 2, 8, 0, tzinfo=timezone.utc))
    _write_file(project_root / "Bakgrunnsdokumenter" / "bakgrunn.pdf", b"pdf-bytes", modified_at=datetime(2026, 6, 2, 8, 5, tzinfo=timezone.utc))
    _write_file(comments_root / "Alpha Project - Kommentardokument.docx", b"older-docx", modified_at=datetime(2026, 6, 1, 8, 0, tzinfo=timezone.utc))
    _write_file(outputs_root / "Alpha Project - Vedlegg.docx", b"newer-docx", modified_at=datetime(2026, 6, 2, 8, 30, tzinfo=timezone.utc))
    (outputs_root / "run_summary.json").write_text(
        json.dumps(
            {
                "project_name": "Alpha Project",
                "status": "completed_with_warnings",
                "started_at": "2026-06-02T08:00:00+00:00",
                "finished_at": "2026-06-02T08:45:00+00:00",
                "provider": "fake",
                "model": None,
                "documents_seen": 2,
                "chunks_created": 2,
                "report_items_count": 2,
                "output_docx_path": str(outputs_root / "Alpha Project - Vedlegg.docx"),
                "warnings": [],
                "errors": [],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    state_db = runtime_root / "state" / "onedrive_lightweight_state.sqlite3"
    state_db.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(state_db) as connection:
        connection.execute(
            """
            CREATE TABLE projects (
                project_name TEXT,
                remote_root_path TEXT,
                local_project_root TEXT,
                analysis_status TEXT,
                last_sync_at TEXT,
                last_analyzed_at TEXT,
                updated_at TEXT,
                report_path TEXT,
                report_url TEXT
            )
            """
        )
        connection.execute(
            """
            INSERT INTO projects (
                project_name,
                remote_root_path,
                local_project_root,
                analysis_status,
                last_sync_at,
                last_analyzed_at,
                updated_at,
                report_path,
                report_url
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "Alpha Project",
                "AnbudAppliance/Urban_Reuse_Norway/Alpha Project",
                str(project_root),
                "completed_with_warnings",
                "2026-06-02T08:50:00+00:00",
                None,
                "2026-06-02T08:55:00+00:00",
                "",
                "",
            ),
        )
        connection.commit()

    return appliance_root


def _write_sync_state(
    state_path: Path,
    *,
    project_name: str,
    project_root: Path,
    source_relative_paths: list[str],
) -> None:
    root_folder_name = "OneDrive_1_21.5.2026 (1)"
    root_local_path = project_root / root_folder_name
    items_by_id: dict[str, dict[str, object]] = {
        "root-folder": {
            "remote_item_id": "root-folder",
            "remote_parent_id": "project-root",
            "parent_path": "",
            "name": root_folder_name,
            "relative_path": root_folder_name,
            "local_path": str(root_local_path),
            "local_cache_path": str(root_local_path),
            "is_folder": True,
            "e_tag": "\"root-folder\"",
            "last_modified_date_time": "2026-05-21T11:17:02Z",
            "sha256": None,
            "size": 0,
        }
    }

    for index, relative_path in enumerate(source_relative_paths, start=1):
        local_path = root_local_path / relative_path
        items_by_id[f"file-{index}"] = {
            "remote_item_id": f"file-{index}",
            "remote_parent_id": "root-folder",
            "parent_path": root_folder_name,
            "name": Path(relative_path).name,
            "relative_path": f"{root_folder_name}/{relative_path}",
            "local_path": str(local_path),
            "local_cache_path": str(local_path),
            "is_folder": False,
            "e_tag": f"\"file-{index}\"",
            "last_modified_date_time": f"2026-05-21T11:17:{index:02d}Z",
            "sha256": None,
            "size": 10_000 + index,
        }

    state_payload = {
        "sync_key": f"{project_name.lower().replace(' ', '-')}-sync",
        "tenant_id": "tenant-id",
        "client_id": "client-id",
        "onedrive_user": "user@example.com",
        "remote_root_item_id": "project-root",
        "remote_root_name": project_name,
        "remote_root_path": f"AnbudAppliance/Urban_Reuse_Norway/{project_name}",
        "local_sync_base": str(project_root.parent),
        "state_storage_base": str(state_path.parent),
        "local_project_root": str(project_root),
        "delta_link": None,
        "items_by_id": items_by_id,
        "last_synced_at": "2026-06-04T16:01:09.714689+00:00",
        "total_downloaded_files": len(source_relative_paths),
        "total_changed_files": 0,
        "total_skipped_files": 0,
        "total_moved_files": 0,
        "total_deleted_files": 0,
        "total_renamed_files": 0,
        "total_failed_files": 0,
        "total_bytes_transferred": 0,
    }
    state_path.parent.mkdir(parents=True, exist_ok=True)
    state_path.write_text(json.dumps(state_payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _build_state_only_appliance_root(
    tmp_path: Path,
    *,
    project_name: str,
    source_relative_paths: list[str],
    sample_source_relative_paths: list[str] | None = None,
) -> Path:
    appliance_root = tmp_path / "appliance"
    runtime_root = appliance_root / ".riveanbud_runtime" / "rive-anbud-appliance" / "Urban_Reuse_Norway"
    project_root = (
        runtime_root
        / "cache"
        / "onedrive_sync"
        / "test-sync-id"
        / "post@example.com"
        / "test-drive-id"
        / project_name
    )
    outputs_root = appliance_root / "outputs" / "Urban_Reuse_Norway" / project_name / "2026-06-02" / "enterprise_review"
    sample_root = appliance_root / "sample_projects" / project_name

    sample_comment_root = sample_root / "Kommentarer"
    _write_file(
        sample_comment_root / f"{project_name} - Kommentardokument.docx",
        b"sample-comment-docx",
        modified_at=datetime(2026, 6, 1, 8, 0, tzinfo=timezone.utc),
    )

    for index, relative_path in enumerate(sample_source_relative_paths or [], start=1):
        _write_file(
            sample_root / relative_path,
            f"sample-source-{index}".encode("utf-8"),
            modified_at=datetime(2026, 6, 1, 7, index, tzinfo=timezone.utc),
        )

    _write_file(
        outputs_root / f"{project_name} - Kommentardokument.docx",
        b"output-comment-docx",
        modified_at=datetime(2026, 6, 2, 9, 0, tzinfo=timezone.utc),
    )
    (outputs_root / "run_summary.json").write_text(
        json.dumps(
            {
                "project_name": project_name,
                "status": "completed_with_warnings",
                "started_at": "2026-06-02T08:00:00+00:00",
                "finished_at": "2026-06-02T08:45:00+00:00",
                "provider": "fake",
                "model": None,
                "documents_seen": len(source_relative_paths),
                "chunks_created": len(source_relative_paths),
                "report_items_count": len(source_relative_paths),
                "output_docx_path": str(outputs_root / f"{project_name} - Kommentardokument.docx"),
                "warnings": [],
                "errors": [],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    _write_sync_state(
        runtime_root / "state" / "onedrive_sync" / "test-sync-id" / "post@example.com" / "test-drive-id" / "sync_state.json",
        project_name=project_name,
        project_root=project_root,
        source_relative_paths=source_relative_paths,
    )

    state_db = runtime_root / "state" / "onedrive_lightweight_state.sqlite3"
    state_db.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(state_db) as connection:
        connection.execute(
            """
            CREATE TABLE projects (
                project_name TEXT,
                remote_root_path TEXT,
                local_project_root TEXT,
                analysis_status TEXT,
                last_sync_at TEXT,
                last_analyzed_at TEXT,
                updated_at TEXT,
                report_path TEXT,
                report_url TEXT
            )
            """
        )
        connection.execute(
            """
            INSERT INTO projects (
                project_name,
                remote_root_path,
                local_project_root,
                analysis_status,
                last_sync_at,
                last_analyzed_at,
                updated_at,
                report_path,
                report_url
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                project_name,
                f"AnbudAppliance/Urban_Reuse_Norway/{project_name}",
                str(project_root),
                "completed_with_warnings",
                "2026-06-02T08:50:00+00:00",
                None,
                "2026-06-02T08:55:00+00:00",
                "",
                "",
            ),
        )
        connection.commit()

    return appliance_root


def test_health_reports_appliance_availability_and_version() -> None:
    client = _client()

    response = client.get("/api/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["appliance_available"] is True
    assert payload["version"] == "0.1.0"
    assert payload["discovered_projects"] >= 6
    assert payload["uptime_seconds"] >= 0
    assert payload["appliance_root"].endswith("/home/anbudklient/appliance")


def test_projects_endpoint_lists_discovered_projects() -> None:
    client = _client()

    response = client.get("/api/projects")

    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 6

    names = {project["project_name"] for project in payload["projects"]}
    assert names == {
        "Testprosjekt",
        "TE_Demo",
        "Bryn Skole",
        "Citypassasjen",
        "Sørkedalsveien 6",
        "TestProsjekt#1",
    }

    testprosjekt = next(project for project in payload["projects"] if project["project_name"] == "Testprosjekt")
    assert testprosjekt["display_name"] == "Testprosjekt"
    assert testprosjekt["source_label"] == "OneDrive"
    assert testprosjekt["relative_project_path"] == "sample_projects/Testprosjekt"
    assert testprosjekt["is_sample_project"] is True
    assert testprosjekt["latest_comment_document"] == "Testprosjekt - Kommentardokument.docx"
    assert testprosjekt["latest_comment_modified_at"] is not None
    assert testprosjekt["status"] == "completed_with_warnings"
    assert testprosjekt["file_count"] == 7
    assert testprosjekt["report_count"] == 1
    assert testprosjekt["comment_document_count"] == 1

    bryn = next(project for project in payload["projects"] if project["project_name"] == "Bryn Skole")
    assert bryn["display_name"] == "Bryn Skole"
    assert bryn["source_label"] == "OneDrive"
    assert bryn["is_sample_project"] is False
    assert bryn["hidden_internal_path"]
    assert bryn["status"]
    assert bryn["file_count"] == 395
    assert bryn["report_count"] == 1
    assert bryn["comment_document_count"] == 1
    assert bryn["latest_comment_document"] == "Bryn Skole - Kommentardokument.docx"
    assert bryn["latest_comment_document_open_url"] == "/api/projects/Bryn%20Skole/reports/latest/open"


def test_sample_project_detail_reports_and_files() -> None:
    client = _client()
    project = _project_path("Testprosjekt")

    detail_response = client.get(f"/api/projects/{project}")
    reports_response = client.get(f"/api/projects/{project}/reports")
    files_response = client.get(f"/api/projects/{project}/files")

    assert detail_response.status_code == 200
    detail = detail_response.json()
    assert detail["project_name"] == "Testprosjekt"
    assert detail["display_name"] == "Testprosjekt"
    assert detail["source_label"] == "OneDrive"
    assert detail["relative_project_path"] == "sample_projects/Testprosjekt"
    assert detail["is_sample_project"] is True
    assert detail["hidden_internal_path"]
    assert detail["latest_comment_document"] == "Testprosjekt - Kommentardokument.docx"
    assert detail["status"] == "completed_with_warnings"
    assert detail["file_count"] == 7
    assert detail["report_count"] == 1
    assert detail["comment_document_count"] == 1
    assert detail["analysis"]["status"] == "completed_with_warnings"
    assert detail["analysis"]["output_docx_path"].endswith("Testprosjekt - Kommentardokument.docx")

    assert reports_response.status_code == 200
    reports = reports_response.json()
    assert reports["count"] == 1
    assert reports["display_name"] == "Testprosjekt"
    assert reports["source_label"] == "OneDrive"
    assert reports["relative_project_path"] == "sample_projects/Testprosjekt"
    assert reports["is_sample_project"] is True
    assert reports["latest_comment_document"] == "Testprosjekt - Kommentardokument.docx"
    assert reports["comment_document_count"] == 1
    assert [item["report_name"] for item in reports["reports"]] == ["Testprosjekt - Kommentardokument.docx"]
    assert reports["reports"][0]["is_latest"] is True

    assert files_response.status_code == 200
    files = files_response.json()
    assert files["total_files"] == 7
    assert files["display_name"] == "Testprosjekt"
    assert files["source_label"] == "OneDrive"
    assert files["relative_project_path"] == "sample_projects/Testprosjekt"
    assert files["is_sample_project"] is True
    assert files["latest_comment_document"] == "Testprosjekt - Kommentardokument.docx"
    assert files["comment_document_count"] == 1
    assert [child["name"] for child in files["file_tree"]["children"]] == [
        "Anbud",
        "Bakgrunnsdokumenter",
        "Tegninger",
        "Tidligere kommunikasjon",
    ]


def test_state_projects_discover_comment_documents_from_outputs_root() -> None:
    client = _client()
    for project_name, expected_file_count, expected_report_count, expected_latest, expected_children in [
        ("Bryn Skole", 395, 1, "Bryn Skole - Kommentardokument.docx", ["OneDrive_1_21.5.2026 (1)"]),
        (
            "TestProsjekt#1",
            2,
            1,
            "TestProsjekt#1 - Kommentardokument.docx",
            ["kontraktsgjennomgang_ellingsrud_tue.docx", "Risikovurdering_Bryn_skole_riving_miljosanering_NS8417.docx"],
        ),
    ]:
        project = _project_path(project_name)

        detail_response = client.get(f"/api/projects/{project}")
        reports_response = client.get(f"/api/projects/{project}/reports")
        files_response = client.get(f"/api/projects/{project}/files")
        debug_response = client.get(f"/api/projects/{project}/debug-paths")

        assert detail_response.status_code == 200
        detail = detail_response.json()
        assert detail["project_name"] == project_name
        assert detail["display_name"] == project_name
        assert detail["source_label"] == "OneDrive"
        assert not detail["relative_project_path"].startswith("AnbudAppliance/")
        assert detail["is_sample_project"] is False
        assert detail["latest_comment_document"] == expected_latest
        assert detail["latest_comment_document_open_url"] == f"/api/projects/{project}/reports/latest/open"
        assert detail["status"]
        assert detail["file_count"] == expected_file_count
        assert detail["report_count"] == expected_report_count
        assert detail["comment_document_count"] == expected_report_count
        assert detail["last_analyzed_at"] is not None

        assert reports_response.status_code == 200
        reports = reports_response.json()
        assert reports["count"] == expected_report_count
        assert reports["display_name"] == project_name
        assert reports["source_label"] == "OneDrive"
        assert not reports["relative_project_path"].startswith("AnbudAppliance/")
        assert reports["is_sample_project"] is False
        assert reports["latest_comment_document"] == expected_latest
        assert reports["latest_comment_document_open_url"] == f"/api/projects/{project}/reports/latest/open"
        assert reports["comment_document_count"] == expected_report_count
        assert [item["report_name"] for item in reports["reports"]] == [expected_latest]
        assert reports["reports"][0]["is_latest"] is True
        assert reports["reports"][0]["report_id"] == "0"
        assert reports["reports"][0]["open_url"] == f"/api/projects/{project}/reports/0/open"

        assert files_response.status_code == 200
        files = files_response.json()
        assert files["total_files"] == expected_file_count
        assert files["display_name"] == project_name
        assert files["source_label"] == "OneDrive"
        assert files["is_sample_project"] is False
        assert files["comment_document_count"] == expected_report_count
        assert files["file_tree"]["file_count"] == expected_file_count
        assert [child["name"] for child in files["file_tree"]["children"]] == expected_children

        assert debug_response.status_code == 200
        debug = debug_response.json()
        assert debug["project_name"] == project_name
        assert debug["project_path_exists"] is True
        assert debug["resolved_project_path"]
        assert debug["total_files_on_disk"] == expected_file_count
        assert debug["counted_source_files"] == expected_file_count
        assert debug["comment_documents_found"] == expected_report_count
        assert debug["ignored_file_count"] == 0
        assert debug["ignored_reasons"] == []
        assert len(debug["candidates"]) == 1
        assert debug["candidates"][0]["selected"] is True
        assert debug["candidates"][0]["candidate_path"] == debug["resolved_project_path"]
        assert debug["candidates"][0]["source_file_count"] == expected_file_count
        assert debug["candidates"][0]["source_inventory_mode"] in {"sync_state", "filesystem"}


def test_sample_comment_only_candidate_does_not_override_source_cache(tmp_path: Path) -> None:
    appliance_root = _build_state_only_appliance_root(
        tmp_path,
        project_name="Gamma Project",
        source_relative_paths=[
            "Anbud/tilbud.txt",
            "Bakgrunnsdokumenter/bakgrunn.pdf",
        ],
    )
    client = _client(ApplianceSettings(appliance_root=appliance_root))

    health = client.get("/api/health")
    assert health.status_code == 200
    assert health.json()["discovered_projects"] == 1

    projects = client.get("/api/projects")
    assert projects.status_code == 200
    payload = projects.json()
    assert payload["count"] == 1
    project = payload["projects"][0]
    assert project["project_name"] == "Gamma Project"
    assert project["is_sample_project"] is False
    assert project["file_count"] == 2
    assert project["report_count"] == 1
    assert project["comment_document_count"] == 1
    assert project["latest_comment_document"] == "Gamma Project - Kommentardokument.docx"
    assert project["latest_comment_document_open_url"] == "/api/projects/Gamma%20Project/reports/latest/open"

    detail = client.get("/api/projects/Gamma%20Project")
    assert detail.status_code == 200
    detail_payload = detail.json()
    assert detail_payload["file_count"] == 2
    assert detail_payload["report_count"] == 1
    assert detail_payload["comment_document_count"] == 1
    assert detail_payload["latest_comment_document"] == "Gamma Project - Kommentardokument.docx"

    reports = client.get("/api/projects/Gamma%20Project/reports")
    assert reports.status_code == 200
    reports_payload = reports.json()
    assert reports_payload["count"] == 1
    assert reports_payload["latest_comment_document"] == "Gamma Project - Kommentardokument.docx"
    assert reports_payload["is_sample_project"] is False

    files = client.get("/api/projects/Gamma%20Project/files")
    assert files.status_code == 200
    files_payload = files.json()
    assert files_payload["total_files"] == 2
    assert [child["name"] for child in files_payload["file_tree"]["children"]] == [
        "OneDrive_1_21.5.2026 (1)",
    ]
    assert [child["name"] for child in files_payload["file_tree"]["children"][0]["children"]] == [
        "Anbud",
        "Bakgrunnsdokumenter",
    ]

    debug = client.get("/api/projects/Gamma%20Project/debug-paths")
    assert debug.status_code == 200
    debug_payload = debug.json()
    assert debug_payload["project_name"] == "Gamma Project"
    assert debug_payload["counted_source_files"] == 2
    assert debug_payload["comment_documents_found"] == 1
    assert len(debug_payload["candidates"]) == 2
    selected = next(candidate for candidate in debug_payload["candidates"] if candidate["selected"])
    sample_candidate = next(candidate for candidate in debug_payload["candidates"] if not candidate["selected"])
    assert selected["candidate_path"] == debug_payload["resolved_project_path"]
    assert selected["source_file_count"] == 2
    assert selected["report_count"] == 1
    assert selected["source_inventory_mode"] == "sync_state"
    assert sample_candidate["is_sample_project"] is True
    assert sample_candidate["source_file_count"] == 0
    assert sample_candidate["report_count"] == 1


def test_real_candidate_beats_sample_even_if_sample_has_more_source_files(tmp_path: Path) -> None:
    appliance_root = _build_state_only_appliance_root(
        tmp_path,
        project_name="Delta Project",
        source_relative_paths=[
            "Anbud/tilbud.txt",
            "Bakgrunnsdokumenter/bakgrunn.pdf",
        ],
        sample_source_relative_paths=[
            "Anbud/sample-tilbud.txt",
            "Bakgrunnsdokumenter/sample-bakgrunn.pdf",
            "Tegninger/sample-tegning.dwg",
        ],
    )
    client = _client(ApplianceSettings(appliance_root=appliance_root))

    detail = client.get("/api/projects/Delta%20Project")
    assert detail.status_code == 200
    detail_payload = detail.json()
    assert detail_payload["is_sample_project"] is False
    assert detail_payload["file_count"] == 2

    debug = client.get("/api/projects/Delta%20Project/debug-paths")
    assert debug.status_code == 200
    debug_payload = debug.json()
    assert len(debug_payload["candidates"]) == 2
    selected = next(candidate for candidate in debug_payload["candidates"] if candidate["selected"])
    sample_candidate = next(candidate for candidate in debug_payload["candidates"] if not candidate["selected"])
    assert selected["is_sample_project"] is False
    assert selected["source_file_count"] == 2
    assert sample_candidate["is_sample_project"] is True
    assert sample_candidate["source_file_count"] == 3


def test_custom_root_discovery_is_not_hardcoded_to_existing_project_names(tmp_path: Path) -> None:
    appliance_root = _build_custom_appliance_root(tmp_path)
    client = _client(ApplianceSettings(appliance_root=appliance_root))

    health = client.get("/api/health")
    assert health.status_code == 200
    assert health.json()["version"] is None
    assert health.json()["discovered_projects"] == 1

    projects = client.get("/api/projects")
    assert projects.status_code == 200
    payload = projects.json()
    assert payload["count"] == 1
    assert payload["projects"][0]["project_name"] == "Alpha Project"
    assert payload["projects"][0]["display_name"] == "Alpha Project"
    assert payload["projects"][0]["relative_project_path"] == "Urban_Reuse_Norway/Alpha Project"
    assert payload["projects"][0]["source_label"] == "OneDrive"
    assert payload["projects"][0]["is_sample_project"] is False
    assert payload["projects"][0]["file_count"] == 2
    assert payload["projects"][0]["report_count"] == 2
    assert payload["projects"][0]["comment_document_count"] == 2
    assert payload["projects"][0]["latest_comment_document"] == "Alpha Project - Kommentardokument.docx"
    assert payload["projects"][0]["latest_comment_document_open_url"] == "/api/projects/Alpha%20Project/reports/latest/open"
    assert payload["projects"][0]["status"] == "completed_with_warnings"

    detail = client.get("/api/projects/Alpha%20Project")
    assert detail.status_code == 200
    detail_payload = detail.json()
    assert detail_payload["analysis"]["status"] == "completed_with_warnings"
    assert detail_payload["analysis"]["output_docx_path"].endswith("Alpha Project - Vedlegg.docx")
    assert detail_payload["last_analyzed_at"] is not None
    assert detail_payload["report_count"] == 2
    assert detail_payload["file_count"] == 2
    assert detail_payload["comment_document_count"] == 2

    reports = client.get("/api/projects/Alpha%20Project/reports")
    assert reports.status_code == 200
    report_payload = reports.json()
    assert report_payload["count"] == 2
    assert report_payload["display_name"] == "Alpha Project"
    assert report_payload["relative_project_path"] == "Urban_Reuse_Norway/Alpha Project"
    assert report_payload["source_label"] == "OneDrive"
    assert report_payload["is_sample_project"] is False
    assert report_payload["latest_comment_document"] == "Alpha Project - Kommentardokument.docx"
    assert report_payload["comment_document_count"] == 2
    assert [item["report_name"] for item in report_payload["reports"]] == [
        "Alpha Project - Kommentardokument.docx",
        "Alpha Project - Vedlegg.docx",
    ]
    assert report_payload["reports"][0]["is_latest"] is True
    assert report_payload["reports"][0]["report_id"] == "0"
    assert report_payload["reports"][0]["open_url"] == "/api/projects/Alpha%20Project/reports/0/open"
    assert report_payload["reports"][1]["report_id"] == "1"
    assert report_payload["reports"][1]["open_url"] == "/api/projects/Alpha%20Project/reports/1/open"

    latest_open = client.get("/api/projects/Alpha%20Project/reports/latest/open")
    assert latest_open.status_code == 200
    assert latest_open.content == b"older-docx"
    content_disposition = latest_open.headers["content-disposition"]
    assert "Alpha Project - Kommentardokument.docx" in content_disposition or "Alpha%20Project%20-%20Kommentardokument.docx" in content_disposition
    assert "/home/" not in content_disposition
    assert ".riveanbud_runtime" not in content_disposition
    assert "outputs" not in content_disposition

    invalid_open = client.get("/api/projects/Alpha%20Project/reports/99/open")
    assert invalid_open.status_code == 404
    assert invalid_open.json()["code"] == "report_not_found"

    files = client.get("/api/projects/Alpha%20Project/files")
    assert files.status_code == 200
    file_payload = files.json()
    assert file_payload["total_files"] == 2
    assert file_payload["display_name"] == "Alpha Project"
    assert file_payload["relative_project_path"] == "Urban_Reuse_Norway/Alpha Project"
    assert file_payload["source_label"] == "OneDrive"
    assert file_payload["is_sample_project"] is False
    assert file_payload["comment_document_count"] == 2
    assert [child["name"] for child in file_payload["file_tree"]["children"]] == [
        "Anbud",
        "Bakgrunnsdokumenter",
    ]

    debug = client.get("/api/projects/Alpha%20Project/debug-paths")
    assert debug.status_code == 200
    debug_payload = debug.json()
    assert debug_payload["project_name"] == "Alpha Project"
    assert debug_payload["project_path_exists"] is True
    assert debug_payload["counted_source_files"] == 2
    assert debug_payload["total_files_on_disk"] == 3
    assert debug_payload["comment_documents_found"] == 2
    assert debug_payload["ignored_file_count"] == 1
    assert "Kommentarer folders are excluded from source file counts." in debug_payload["ignored_reasons"]
