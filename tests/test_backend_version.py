from __future__ import annotations

import json
import subprocess
from pathlib import Path

from backend.app.version import _advance_version, get_app_version


def _write_package_json(path: Path, version: str) -> Path:
    package_json = path / "frontend" / "package.json"
    package_json.parent.mkdir(parents=True, exist_ok=True)
    package_json.write_text(json.dumps({"version": version}), encoding="utf-8")
    return package_json


def _git(repo_root: Path, *args: str) -> None:
    subprocess.run(["git", *args], cwd=repo_root, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)


def _commit(repo_root: Path, message: str) -> None:
    _git(repo_root, "add", ".")
    _git(repo_root, "commit", "-m", message)


def _init_repo(repo_root: Path) -> None:
    _git(repo_root, "init")
    _git(repo_root, "config", "user.email", "nexus@example.test")
    _git(repo_root, "config", "user.name", "Nexus Test")


def test_app_version_advances_numerically_from_package_version_commit(tmp_path: Path) -> None:
    source = _write_package_json(tmp_path, "0.1.9")
    _init_repo(tmp_path)
    _commit(tmp_path, "release 0.1.9")

    assert get_app_version(source=source, repo_root=tmp_path, environ={}) == "0.1.9"

    for index in range(3):
        (tmp_path / f"change-{index}.txt").write_text(str(index), encoding="utf-8")
        _commit(tmp_path, f"change {index}")

    assert get_app_version(source=source, repo_root=tmp_path, environ={}) == "0.1.12"


def test_app_version_uses_requested_rollover_sequence() -> None:
    assert _advance_version("0.1.9", 10) == "0.1.19"
    assert _advance_version("0.1.9", 11) == "0.2.0"
    assert _advance_version("0.9.19", 1) == "1.0.0"


def test_app_version_prefers_build_version_environment(tmp_path: Path) -> None:
    source = _write_package_json(tmp_path, "0.1.9")

    assert get_app_version(source=source, repo_root=tmp_path, environ={"URN_NEXUS_BUILD_VERSION": "0.4.7"}) == "0.4.7"
