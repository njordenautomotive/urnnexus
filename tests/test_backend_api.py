from __future__ import annotations

import asyncio
import json
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


def _build_custom_appliance_root(tmp_path: Path) -> Path:
    appliance_root = tmp_path / "appliance"
    project_root = appliance_root / "sample_projects" / "Alpha"

    for folder in [
        "Anbud",
        "Bakgrunnsdokumenter",
        "Tegninger",
        "Tidligere kommunikasjon",
        "Kommentarer",
    ]:
        (project_root / folder).mkdir(parents=True, exist_ok=True)

    (project_root / "Anbud" / "tilbud.txt").write_text("Alpha tender", encoding="utf-8")
    (project_root / "Kommentarer" / "Alpha - Kommentardokument.docx").write_bytes(b"docx-bytes")
    (project_root / "Kommentarer" / "run_summary.json").write_text(
        json.dumps(
            {
                "project_name": "Alpha",
                "status": "completed",
                "started_at": "2026-06-04T08:00:00+02:00",
                "finished_at": "2026-06-04T09:00:00+02:00",
                "provider": "fake",
                "model": None,
                "documents_seen": 1,
                "chunks_created": 1,
                "report_items_count": 1,
                "output_docx_path": str(project_root / "Kommentarer" / "Alpha - Kommentardokument.docx"),
                "warnings": [],
                "errors": [],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
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
    assert testprosjekt["status"] == "completed_with_warnings"
    assert testprosjekt["file_count"] == 7
    assert testprosjekt["report_count"] == 1

    bryn = next(project for project in payload["projects"] if project["project_name"] == "Bryn Skole")
    assert bryn["status"] == "skipped_no_changes"
    assert bryn["file_count"] == 0
    assert bryn["report_count"] == 0


def test_sample_project_detail_reports_and_files() -> None:
    client = _client()
    project = _project_path("Testprosjekt")

    detail_response = client.get(f"/api/projects/{project}")
    reports_response = client.get(f"/api/projects/{project}/reports")
    files_response = client.get(f"/api/projects/{project}/files")

    assert detail_response.status_code == 200
    detail = detail_response.json()
    assert detail["project_name"] == "Testprosjekt"
    assert detail["status"] == "completed_with_warnings"
    assert detail["file_count"] == 7
    assert detail["report_count"] == 1
    assert detail["analysis"]["status"] == "completed_with_warnings"
    assert detail["analysis"]["output_docx_path"].endswith("Testprosjekt - Kommentardokument.docx")

    assert reports_response.status_code == 200
    reports = reports_response.json()
    assert reports["count"] == 1
    assert [item["report_name"] for item in reports["reports"]] == ["Testprosjekt - Kommentardokument.docx"]
    assert reports["reports"][0]["is_latest"] is True

    assert files_response.status_code == 200
    files = files_response.json()
    assert files["total_files"] == 7
    assert [child["name"] for child in files["file_tree"]["children"]] == [
        "Anbud",
        "Bakgrunnsdokumenter",
        "Tegninger",
        "Tidligere kommunikasjon",
    ]


def test_state_project_without_reports_returns_empty_lists() -> None:
    client = _client()
    project = _project_path("Bryn Skole")

    detail_response = client.get(f"/api/projects/{project}")
    reports_response = client.get(f"/api/projects/{project}/reports")
    files_response = client.get(f"/api/projects/{project}/files")

    assert detail_response.status_code == 200
    detail = detail_response.json()
    assert detail["project_name"] == "Bryn Skole"
    assert detail["status"] == "skipped_no_changes"
    assert detail["file_count"] == 0
    assert detail["report_count"] == 0
    assert detail["last_analyzed_at"] is None

    assert reports_response.status_code == 200
    reports = reports_response.json()
    assert reports["count"] == 0
    assert reports["reports"] == []

    assert files_response.status_code == 200
    files = files_response.json()
    assert files["total_files"] == 0
    assert files["file_tree"]["children"] == []


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
    assert payload["projects"][0]["project_name"] == "Alpha"
    assert payload["projects"][0]["file_count"] == 1
    assert payload["projects"][0]["report_count"] == 1
    assert payload["projects"][0]["status"] == "completed"

    reports = client.get("/api/projects/Alpha/reports")
    assert reports.status_code == 200
    assert reports.json()["count"] == 1

    files = client.get("/api/projects/Alpha/files")
    assert files.status_code == 200
    assert files.json()["total_files"] == 1
    assert [child["name"] for child in files.json()["file_tree"]["children"]] == ["Anbud"]
