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

    def post(
        self,
        path: str,
        *,
        json: object | None = None,
        data: dict[str, str] | None = None,
        files: dict[str, tuple[str, bytes, str]] | None = None,
    ) -> httpx.Response:
        async def _request() -> httpx.Response:
            transport = httpx.ASGITransport(app=self._app)
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                return await client.post(path, json=json, data=data, files=files)

        return asyncio.run(_request())

    def delete(self, path: str) -> httpx.Response:
        async def _request() -> httpx.Response:
            transport = httpx.ASGITransport(app=self._app)
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                return await client.delete(path)

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
    _write_file(
        comments_root / "Alpha Project - Kommentardokument - 1.0.docx",
        b"newer-docx",
        modified_at=datetime(2026, 6, 2, 8, 30, tzinfo=timezone.utc),
    )
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
    project_comment_root = project_root / "Kommentarer"
    outputs_root = appliance_root / "outputs" / "Urban_Reuse_Norway" / project_name / "2026-06-02" / "enterprise_review"
    sample_root = appliance_root / "sample_projects" / project_name

    sample_comment_root = sample_root / "Kommentarer"
    _write_file(
        project_comment_root / f"{project_name} - Kommentardokument.docx",
        b"output-comment-docx",
        modified_at=datetime(2026, 6, 2, 9, 0, tzinfo=timezone.utc),
    )
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

    outputs_root.mkdir(parents=True, exist_ok=True)
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
            3,
            2,
            "TestProsjekt#1 - Kommentardokument.docx",
            [
                "Dette er et testdokument.docx",
                "kontraktsgjennomgang_ellingsrud_tue.docx",
                "Risikovurdering_Bryn_skole_riving_miljosanering_NS8417.docx",
            ],
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
        assert [item["report_name"] for item in reports["reports"]] == [expected_latest] * expected_report_count
        assert reports["reports"][0]["is_latest"] is True
        assert reports["reports"][0]["report_id"] == "0"
        assert reports["reports"][0]["open_url"] == f"/api/projects/{project}/reports/0/open"
        assert reports["reports"][0]["download_url"] == f"/api/projects/{project}/reports/0/download"

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
        assert isinstance(debug["project_path_exists"], bool)
        assert debug["resolved_project_path"]
        assert debug["total_files_on_disk"] == expected_file_count
        assert debug["counted_source_files"] == expected_file_count
        assert debug["comment_documents_found"] == expected_report_count
        assert debug["ignored_file_count"] == 0
        assert debug["ignored_reasons"] == []
        assert len(debug["candidates"]) == 1
        assert debug["candidates"][0]["selected"] is True
        if not debug["project_path_exists"]:
            assert debug["candidates"][0]["source_inventory_mode"] == "sync_state"
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
    assert payload["projects"][0]["latest_comment_document"] == "Alpha Project - Kommentardokument - 1.0.docx"
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
    assert detail_payload["latest_comment_document"] == "Alpha Project - Kommentardokument - 1.0.docx"
    assert detail_payload["latest_comment_created_at"] is not None

    reports = client.get("/api/projects/Alpha%20Project/reports")
    assert reports.status_code == 200
    report_payload = reports.json()
    assert report_payload["count"] == 2
    assert report_payload["display_name"] == "Alpha Project"
    assert report_payload["relative_project_path"] == "Urban_Reuse_Norway/Alpha Project"
    assert report_payload["source_label"] == "OneDrive"
    assert report_payload["is_sample_project"] is False
    assert report_payload["latest_comment_document"] == "Alpha Project - Kommentardokument - 1.0.docx"
    assert report_payload["comment_document_count"] == 2
    assert [item["report_name"] for item in report_payload["reports"]] == [
        "Alpha Project - Kommentardokument - 1.0.docx",
        "Alpha Project - Kommentardokument.docx",
    ]
    assert report_payload["reports"][0]["is_latest"] is True
    assert report_payload["reports"][0]["report_id"] == "0"
    assert report_payload["reports"][0]["open_url"] == "/api/projects/Alpha%20Project/reports/0/open"
    assert report_payload["reports"][0]["download_url"] == "/api/projects/Alpha%20Project/reports/0/download"
    assert report_payload["reports"][1]["report_id"] == "1"
    assert report_payload["reports"][1]["open_url"] == "/api/projects/Alpha%20Project/reports/1/open"
    assert report_payload["reports"][1]["download_url"] == "/api/projects/Alpha%20Project/reports/1/download"
    assert report_payload["reports"][0]["version"] == "1.0"
    assert report_payload["reports"][0]["created_at"] is not None
    assert report_payload["reports"][1]["version"] is None

    latest_open = client.get("/api/projects/Alpha%20Project/reports/latest/open")
    assert latest_open.status_code == 200
    assert latest_open.content == b"newer-docx"
    content_disposition = latest_open.headers["content-disposition"]
    assert "Alpha Project - Kommentardokument - 1.0.docx" in content_disposition or "Alpha%20Project%20-%20Kommentardokument%20-%201.0.docx" in content_disposition
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
    anbud_folder = file_payload["file_tree"]["children"][0]
    tilbud_file = anbud_folder["children"][0]
    assert anbud_folder["relative_path"] == "Anbud"
    assert tilbud_file["name"] == "tilbud.txt"
    assert tilbud_file["relative_path"] == "Anbud/tilbud.txt"
    assert tilbud_file["display_name"] == "tilbud.txt"
    assert tilbud_file["open_url"] == "/api/projects/Alpha%20Project/files/open?path=Anbud%2Ftilbud.txt"
    assert tilbud_file["download_url"] == "/api/projects/Alpha%20Project/files/download?path=Anbud%2Ftilbud.txt"

    file_open = client.get("/api/projects/Alpha%20Project/files/open?path=Anbud%2Ftilbud.txt")
    assert file_open.status_code == 200
    assert file_open.content == b"Alpha tender"
    assert "tilbud.txt" in file_open.headers["content-disposition"]

    file_download = client.get("/api/projects/Alpha%20Project/files/download?path=Bakgrunnsdokumenter%2Fbakgrunn.pdf")
    assert file_download.status_code == 200
    assert file_download.content == b"pdf-bytes"
    assert "attachment" in file_download.headers["content-disposition"]

    traversal = client.get("/api/projects/Alpha%20Project/files/open?path=..%2F..%2F.env")
    assert traversal.status_code == 404
    assert traversal.json()["code"] == "file_not_found"

    debug = client.get("/api/projects/Alpha%20Project/debug-paths")
    assert debug.status_code == 200
    debug_payload = debug.json()
    assert debug_payload["project_name"] == "Alpha Project"
    assert debug_payload["project_path_exists"] is True
    assert debug_payload["counted_source_files"] == 2
    assert debug_payload["total_files_on_disk"] == 4
    assert debug_payload["comment_documents_found"] == 2
    assert debug_payload["ignored_file_count"] == 2
    assert "Kommentarer folders are excluded from source file counts." in debug_payload["ignored_reasons"]


def test_project_write_operations_use_project_relative_paths(tmp_path: Path) -> None:
    appliance_root = _build_custom_appliance_root(tmp_path)
    folder_calls: list[dict[str, object]] = []
    upload_calls: list[dict[str, object]] = []

    class FakeOneDriveWriter:
        def create_project(self, project_name: str, *, folders: list[str], parent_remote_path: str) -> list[str]:
            return folders

        def create_project_folder(
            self,
            project_name: str,
            folder_name: str,
            *,
            parent_remote_path: str,
            target_folder: str | None = None,
        ) -> dict[str, object]:
            folder_calls.append(
                {
                    "project_name": project_name,
                    "folder_name": folder_name,
                    "parent_remote_path": parent_remote_path,
                    "target_folder": target_folder,
                }
            )
            return {"id": "folder-id", "name": folder_name, "webUrl": "https://example.com/folder"}

        def upload_file(
            self,
            project_name: str,
            filename: str,
            content: bytes,
            *,
            parent_remote_path: str,
            target_folder: str | None = None,
        ) -> dict[str, object]:
            upload_calls.append(
                {
                    "project_name": project_name,
                    "filename": filename,
                    "content": content,
                    "parent_remote_path": parent_remote_path,
                    "target_folder": target_folder,
                }
            )
            return {"id": "file-id", "name": filename, "webUrl": "https://example.com/file"}

        def delete_project(self, project_name: str, *, parent_remote_path: str) -> str:
            return f"{parent_remote_path}/{project_name}"

    client = _AsyncAppClient(create_app(ApplianceSettings(appliance_root=appliance_root), onedrive_writer=FakeOneDriveWriter()))

    folder_response = client.post(
        "/api/projects/Alpha%20Project/files/folders",
        json={"folder_name": "Ny mappe", "target_folder": "Anbud"},
    )
    assert folder_response.status_code == 200
    folder_payload = folder_response.json()
    assert folder_payload["project_name"] == "Alpha Project"
    assert folder_payload["relative_path"] == "Anbud/Ny mappe"
    assert folder_payload["mode"] == "onedrive"
    assert folder_payload["warning"] is None

    upload_response = client.post(
        "/api/projects/Alpha%20Project/files/upload",
        data={"target_folder": "Anbud/Ny mappe"},
        files={"file": ("notat.txt", b"uploaded-note", "text/plain")},
    )
    assert upload_response.status_code == 200
    upload_payload = upload_response.json()
    assert upload_payload["filename"] == "notat.txt"
    assert upload_payload["relative_path"] == "Anbud/Ny mappe/notat.txt"
    assert upload_payload["size_bytes"] == len(b"uploaded-note")
    assert upload_payload["mode"] == "onedrive"

    uploaded_open = client.get("/api/projects/Alpha%20Project/files/open?path=Anbud%2FNy%20mappe%2Fnotat.txt")
    assert uploaded_open.status_code == 404
    assert uploaded_open.json()["code"] == "file_not_found"

    assert folder_calls == [
        {
            "project_name": "Alpha Project",
            "folder_name": "Ny mappe",
            "parent_remote_path": "AnbudAppliance/Urban_Reuse_Norway",
            "target_folder": "Anbud",
        }
    ]
    assert upload_calls == [
        {
            "project_name": "Alpha Project",
            "filename": "notat.txt",
            "content": b"uploaded-note",
            "parent_remote_path": "AnbudAppliance/Urban_Reuse_Norway",
            "target_folder": "Anbud/Ny mappe",
        }
    ]

    invalid_upload = client.post(
        "/api/projects/Alpha%20Project/files/upload",
        data={"target_folder": "Anbud"},
        files={"file": ("../evil.txt", b"nope", "text/plain")},
    )
    assert invalid_upload.status_code == 400
    assert invalid_upload.json()["code"] == "write_error"


def test_create_project_fails_when_graph_write_is_not_configured(tmp_path: Path) -> None:
    appliance_root = tmp_path / "appliance"
    appliance_root.mkdir()
    client = _client(ApplianceSettings(appliance_root=appliance_root))

    create_response = client.post("/api/projects", json={"project_name": "Portal Prosjekt"})

    assert create_response.status_code == 503
    assert create_response.json()["code"] == "graph_write_unavailable"
    assert not (appliance_root / "cache" / "urn_nexus_local_projects" / "Urban_Reuse_Norway" / "Portal Prosjekt").exists()


def test_create_project_uses_onedrive_writer_and_sync_before_visible(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    appliance_root = tmp_path / "appliance"
    appliance_root.mkdir()
    writer_calls: list[tuple[str, list[str], str]] = []

    class FakeOneDriveWriter:
        def create_project(self, project_name: str, *, folders: list[str], parent_remote_path: str) -> list[str]:
            writer_calls.append((project_name, folders, parent_remote_path))
            return folders

    app = create_app(ApplianceSettings(appliance_root=appliance_root), onedrive_writer=FakeOneDriveWriter())
    service = app.state.appliance_service

    def fake_sync(project_name: str) -> None:
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
        for folder in [
            "Anbud",
            "Bakgrunnsdokumenter",
            "Tegninger",
            "Tidligere kommunikasjon",
            "Kommentarer",
        ]:
            (project_root / folder).mkdir(parents=True, exist_ok=True)
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
                    "pending",
                    "2026-06-02T08:50:00+00:00",
                    None,
                    "2026-06-02T08:55:00+00:00",
                    "",
                    "",
                ),
            )
            connection.commit()

    monkeypatch.setattr(service, "_require_sync_only_available", lambda: None)
    monkeypatch.setattr(service, "_run_sync_for_project", fake_sync)
    client = _AsyncAppClient(app)

    create_response = client.post("/api/projects", json={"project_name": "Portal Prosjekt"})

    assert create_response.status_code == 200
    create_payload = create_response.json()
    assert create_payload["project_name"] == "Portal Prosjekt"
    assert create_payload["relative_project_path"] == "Urban_Reuse_Norway/Portal Prosjekt"
    assert create_payload["mode"] == "onedrive"
    assert create_payload["folders_created"] == [
        "Anbud",
        "Bakgrunnsdokumenter",
        "Tegninger",
        "Tidligere kommunikasjon",
        "Kommentarer",
    ]
    assert create_payload["warning"] is None
    assert writer_calls == [
        (
            "Portal Prosjekt",
            [
                "Anbud",
                "Bakgrunnsdokumenter",
                "Tegninger",
                "Tidligere kommunikasjon",
                "Kommentarer",
            ],
            "AnbudAppliance/Urban_Reuse_Norway",
        )
    ]
    assert not (appliance_root / "cache" / "urn_nexus_local_projects" / "Urban_Reuse_Norway" / "Portal Prosjekt").exists()

    projects_response = client.get("/api/projects")
    assert projects_response.status_code == 200
    projects_payload = projects_response.json()
    portal_project = next(project for project in projects_payload["projects"] if project["project_name"] == "Portal Prosjekt")
    assert portal_project["source_label"] == "OneDrive"
    assert portal_project["is_local_cache_only"] is False
    assert portal_project["relative_project_path"] == "Urban_Reuse_Norway/Portal Prosjekt"
    assert portal_project["status"] == "pending"


def test_local_only_project_is_hidden_from_standard_project_list(tmp_path: Path) -> None:
    appliance_root = tmp_path / "appliance"
    local_project = appliance_root / "cache" / "urn_nexus_local_projects" / "Urban_Reuse_Norway" / "Kun Lokal"
    (local_project / "Anbud").mkdir(parents=True)
    client = _client(ApplianceSettings(appliance_root=appliance_root))

    projects_response = client.get("/api/projects")
    assert projects_response.status_code == 200
    projects_payload = projects_response.json()
    assert projects_payload["projects"] == []

    debug_response = client.get("/api/projects?include_local_cache=true")
    assert debug_response.status_code == 200
    debug_payload = debug_response.json()
    assert debug_payload["count"] == 1
    assert debug_payload["projects"][0]["project_name"] == "Kun Lokal"
    assert debug_payload["projects"][0]["source_label"] == "Kun lokal cache"
    assert debug_payload["projects"][0]["is_local_cache_only"] is True


def test_delete_project_local_cache_hides_without_deleting_onedrive(tmp_path: Path) -> None:
    appliance_root = tmp_path / "appliance"
    project_name = "Rydd Meg"
    local_project = appliance_root / "cache" / "urn_nexus_local_projects" / "Urban_Reuse_Norway" / project_name
    local_upload = appliance_root / "cache" / "urn_nexus_uploads" / "Urban_Reuse_Norway" / project_name
    output_project = appliance_root / "outputs" / "Urban_Reuse_Norway" / project_name
    remote_onedrive_project = tmp_path / "OneDrive" / "AnbudAppliance" / "Urban_Reuse_Norway" / project_name
    for path in [local_project / "Anbud", local_upload / "Anbud", output_project / "Kommentarer", remote_onedrive_project]:
        path.mkdir(parents=True, exist_ok=True)

    runtime_root = appliance_root / ".riveanbud_runtime" / "rive-anbud-appliance" / "Urban_Reuse_Norway"
    synced_project = runtime_root / "cache" / "onedrive_sync" / "test-sync-id" / "post@example.com" / "test-drive-id" / project_name
    (synced_project / "Anbud").mkdir(parents=True)
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
                str(synced_project),
                "pending",
                "2026-06-02T08:50:00+00:00",
                None,
                "2026-06-02T08:55:00+00:00",
                "",
                "",
            ),
        )
        connection.commit()

    client = _client(ApplianceSettings(appliance_root=appliance_root))

    response = client.delete(f"/api/projects/{_project_path(project_name)}/local-cache")

    assert response.status_code == 200
    payload = response.json()
    assert payload["project_name"] == project_name
    assert payload["hidden"] is True
    assert payload["removed_state_rows"] == 1
    assert not local_project.exists()
    assert not local_upload.exists()
    assert not output_project.exists()
    assert not synced_project.exists()
    assert remote_onedrive_project.exists()

    with sqlite3.connect(state_db) as connection:
        remaining = connection.execute("SELECT COUNT(*) FROM projects").fetchone()[0]
    assert remaining == 0

    projects_response = client.get("/api/projects?include_local_cache=true")
    assert projects_response.status_code == 200
    assert projects_response.json()["projects"] == []


def test_delete_project_removes_project_from_nexus_and_calls_onedrive_delete(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    appliance_root = _build_custom_appliance_root(tmp_path)
    delete_calls: list[tuple[str, str]] = []

    class FakeOneDriveWriter:
        def create_project(self, project_name: str, *, folders: list[str], parent_remote_path: str) -> list[str]:
            return folders

        def create_project_folder(
            self,
            project_name: str,
            folder_name: str,
            *,
            parent_remote_path: str,
            target_folder: str | None = None,
        ) -> dict[str, object]:
            return {"id": "folder-id", "name": folder_name}

        def upload_file(
            self,
            project_name: str,
            filename: str,
            content: bytes,
            *,
            parent_remote_path: str,
            target_folder: str | None = None,
        ) -> dict[str, object]:
            return {"id": "file-id", "name": filename}

        def delete_project(self, project_name: str, *, parent_remote_path: str) -> str:
            delete_calls.append((project_name, parent_remote_path))
            return f"{parent_remote_path}/{project_name}"

    app = create_app(ApplianceSettings(appliance_root=appliance_root), onedrive_writer=FakeOneDriveWriter())
    service = app.state.appliance_service
    monkeypatch.setattr(service, "_require_sync_only_available", lambda: None)
    monkeypatch.setattr(service, "_run_sync_for_project", lambda project_name: None)
    client = _AsyncAppClient(app)

    response = client.delete("/api/projects/Alpha%20Project")

    assert response.status_code == 200
    payload = response.json()
    assert payload["project_name"] == "Alpha Project"
    assert payload["deleted_remote_path"] == "AnbudAppliance/Urban_Reuse_Norway/Alpha Project"
    assert payload["synced"] is True
    assert delete_calls == [("Alpha Project", "AnbudAppliance/Urban_Reuse_Norway")]

    projects_response = client.get("/api/projects")
    assert projects_response.status_code == 200
    assert projects_response.json()["projects"] == []


def test_sync_endpoint_starts_sync_only_nonblocking_job(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    appliance_root = tmp_path / "appliance"
    script_path = appliance_root / "scripts" / "run_onedrive_appliance.py"
    script_path.parent.mkdir(parents=True, exist_ok=True)
    script_path.write_text("# supports --sync-only\n", encoding="utf-8")
    started_commands: list[list[str]] = []

    class DummyProcess:
        returncode: int | None = None

        def poll(self) -> int | None:
            return self.returncode

        def communicate(self) -> tuple[str, str]:
            self.returncode = 0
            return (
                json.dumps(
                    {
                        "per_root_results": [
                            {
                                "status": "completed",
                                "changed_files": 2,
                                "reports_found": 0,
                            }
                        ]
                    }
                ),
                "",
            )

    def fake_popen(command: list[str], **_: object) -> DummyProcess:
        started_commands.append(command)
        return DummyProcess()

    monkeypatch.setattr("backend.app.services.appliance.subprocess.Popen", fake_popen)
    app = create_app(ApplianceSettings(appliance_root=appliance_root))
    client = _AsyncAppClient(app)

    response = client.post("/api/sync/run")
    assert response.status_code == 200
    payload = response.json()
    assert payload["running"] is True
    assert payload["status"] == "started"
    assert payload["sync_only"] is True
    assert payload["analysis_started"] is False
    assert payload["reports_generated"] == 0
    assert payload["projects_synced"] == 0
    assert payload["files_changed"] == 0
    assert payload["reports_found"] == 0
    assert started_commands
    assert "run_onedrive_appliance.py" in started_commands[0][1]
    assert "--once" in started_commands[0]
    assert "--all-roots" in started_commands[0]
    assert "--sync-only" in started_commands[0]
    assert "--force-analyze" not in started_commands[0]
    assert "--provider" not in started_commands[0]
    assert "openai" not in started_commands[0]
    assert "--email-mode" not in started_commands[0]
    assert "immediate" not in started_commands[0]
    assert "daily_digest" not in started_commands[0]
    assert "--local-output-mode" not in started_commands[0]

    status_response = client.get("/api/sync/status")
    assert status_response.status_code == 200
    status_payload = status_response.json()
    assert status_payload["job_id"] == payload["job_id"]
    assert status_payload["status"] in {"running", "completed"}


def test_sync_endpoint_fails_safely_when_sync_only_is_unavailable(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    appliance_root = tmp_path / "appliance"
    script_path = appliance_root / "scripts" / "run_onedrive_appliance.py"
    script_path.parent.mkdir(parents=True, exist_ok=True)
    script_path.write_text("# no safe sync flag here\n", encoding="utf-8")
    started_commands: list[list[str]] = []

    def fake_popen(command: list[str], **_: object) -> object:
        started_commands.append(command)
        raise AssertionError("Nexus must not start full appliance pipeline when sync-only is unavailable.")

    monkeypatch.setattr("backend.app.services.appliance.subprocess.Popen", fake_popen)
    client = _client(ApplianceSettings(appliance_root=appliance_root))

    response = client.post("/api/sync/run")

    assert response.status_code == 503
    payload = response.json()
    assert payload["code"] == "sync_only_unavailable"
    assert payload["detail"] == (
        "Nexus kan ikke synkronisere trygt før appliance støtter sync-only. Full analysepipeline er blokkert fra Nexus."
    )
    assert started_commands == []
