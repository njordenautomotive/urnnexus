from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

from backend.app.config import ApplianceSettings
from backend.app.main import create_app
from backend.app.services.appliance import OSLO_TIMEZONE

from tests.test_backend_api import _AsyncAppClient


def _write_state_row(
    connection: sqlite3.Connection,
    *,
    project_name: str,
    project_root: Path,
    status: str,
    timestamp: datetime,
    last_sync_at: datetime | None = None,
) -> None:
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
            status,
            (last_sync_at or timestamp).isoformat(),
            timestamp.isoformat(),
            timestamp.isoformat(),
            "",
            "",
        ),
    )


def _write_run_summary(
    appliance_root: Path,
    *,
    project_name: str,
    status: str,
    timestamp: datetime,
    warnings: list[str] | None = None,
    errors: list[str] | None = None,
) -> None:
    output_root = appliance_root / "outputs" / "Urban_Reuse_Norway" / project_name / timestamp.strftime("%Y-%m-%d") / "enterprise_review"
    output_root.mkdir(parents=True, exist_ok=True)
    output_docx = output_root / f"{project_name} - Vedlegg.docx"
    output_docx.write_bytes(b"docx")
    (output_root / "run_summary.json").write_text(
        json.dumps(
            {
                "project_name": project_name,
                "status": status,
                "started_at": (timestamp - timedelta(minutes=5)).isoformat(),
                "finished_at": timestamp.isoformat(),
                "provider": "fake",
                "model": None,
                "documents_seen": 1,
                "chunks_created": 1,
                "report_items_count": 1,
                "output_docx_path": str(output_docx),
                "warnings": warnings or [],
                "errors": errors or [],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )


def test_health_counts_recent_analysis_warnings_errors_and_statuses(tmp_path: Path) -> None:
    appliance_root = tmp_path / "appliance"
    runtime_root = appliance_root / ".riveanbud_runtime" / "rive-anbud-appliance" / "Urban_Reuse_Norway"
    state_db = runtime_root / "state" / "onedrive_lightweight_state.sqlite3"
    state_db.parent.mkdir(parents=True, exist_ok=True)

    now = datetime.now(OSLO_TIMEZONE)
    recent = now - timedelta(hours=1)
    old = now - timedelta(days=2)

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

        for project_name, status, timestamp in [
            ("Recent Warning Status", "completed_with_warnings", recent),
            ("Recent Warning Details", "completed", recent),
            ("Recent Failed Status", "failed", recent),
            ("Recent Failed Details", "failed", recent),
            ("Old Warning", "completed_with_warnings", old),
            ("Old Warning Recent Sync", "completed_with_warnings", old),
        ]:
            project_root = runtime_root / "cache" / "onedrive_sync" / "sync-id" / "post@example.com" / "drive-id" / project_name
            (project_root / "Anbud").mkdir(parents=True, exist_ok=True)
            (project_root / "Anbud" / "tilbud.txt").write_text("Tender", encoding="utf-8")
            _write_state_row(
                connection,
                project_name=project_name,
                project_root=project_root,
                status=status,
                timestamp=timestamp,
                last_sync_at=recent if project_name == "Old Warning Recent Sync" else None,
            )

        connection.commit()

    _write_run_summary(appliance_root, project_name="Recent Warning Status", status="completed_with_warnings", timestamp=recent)
    _write_run_summary(
        appliance_root,
        project_name="Recent Warning Details",
        status="completed",
        timestamp=recent,
        warnings=["Missing optional appendix.", "Fallback model used."],
    )
    _write_run_summary(appliance_root, project_name="Recent Failed Status", status="failed", timestamp=recent)
    _write_run_summary(
        appliance_root,
        project_name="Recent Failed Details",
        status="failed",
        timestamp=recent,
        errors=["Document parsing failed.", "Report upload failed."],
    )
    _write_run_summary(appliance_root, project_name="Old Warning", status="completed_with_warnings", timestamp=old)
    _write_run_summary(appliance_root, project_name="Old Warning Recent Sync", status="completed_with_warnings", timestamp=old)

    client = _AsyncAppClient(create_app(ApplianceSettings(appliance_root=appliance_root)))

    response = client.get("/api/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["warnings_last_24h"] == 3
    assert payload["errors_last_24h"] == 3
