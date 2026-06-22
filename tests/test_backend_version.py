from __future__ import annotations

import json
from pathlib import Path

from backend.app.version import get_app_version


def _write_package_json(path: Path, version: str) -> Path:
    package_json = path / "frontend" / "package.json"
    package_json.parent.mkdir(parents=True, exist_ok=True)
    package_json.write_text(json.dumps({"version": version}), encoding="utf-8")
    return package_json


def test_app_version_includes_current_git_commit(tmp_path: Path) -> None:
    source = _write_package_json(tmp_path, "0.1.9")
    git_dir = tmp_path / ".git"
    ref = git_dir / "refs" / "heads" / "main"
    ref.parent.mkdir(parents=True)
    ref.write_text("abc123456789def\n", encoding="utf-8")
    (git_dir / "HEAD").write_text("ref: refs/heads/main\n", encoding="utf-8")

    assert get_app_version(source=source, repo_root=tmp_path, environ={}) == "0.1.9+abc123456789"


def test_app_version_prefers_build_commit_environment(tmp_path: Path) -> None:
    source = _write_package_json(tmp_path, "0.1.9")

    assert get_app_version(source=source, repo_root=tmp_path, environ={"URN_NEXUS_BUILD_COMMIT": "feedfacecafebeef"}) == "0.1.9+feedfacecafe"
