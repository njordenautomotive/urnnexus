from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from collections.abc import Mapping

APP_ROOT = Path(__file__).resolve().parents[2]
APP_VERSION_SOURCE = APP_ROOT / "frontend" / "package.json"
BUILD_VERSION_ENV_KEY = "URN_NEXUS_BUILD_VERSION"
MAX_MINOR = 9
MAX_PATCH = 19


def _load_app_version(source: Path = APP_VERSION_SOURCE) -> str:
    try:
        payload = json.loads(source.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return "0.0.0+unknown"

    version = payload.get("version")
    if isinstance(version, str) and version.strip():
        return version.strip()
    return "0.0.0+unknown"


def _parse_numeric_version(version: str) -> tuple[int, int, int] | None:
    parts = version.strip().split(".")
    if len(parts) != 3:
        return None
    try:
        major, minor, patch = (int(part) for part in parts)
    except ValueError:
        return None
    if major < 0 or minor < 0 or patch < 0:
        return None
    return major, minor, patch


def _advance_version(version: str, commit_offset: int) -> str:
    parsed = _parse_numeric_version(version)
    if parsed is None:
        return version

    major, minor, patch = parsed
    patch += max(0, commit_offset)
    minor += patch // (MAX_PATCH + 1)
    patch %= MAX_PATCH + 1
    major += minor // (MAX_MINOR + 1)
    minor %= MAX_MINOR + 1
    return f"{major}.{minor}.{patch}"


def _git_path(path: Path, repo_root: Path) -> str:
    try:
        return path.resolve().relative_to(repo_root.resolve()).as_posix()
    except ValueError:
        return path.as_posix()


def _run_git(args: list[str], repo_root: Path) -> str | None:
    try:
        result = subprocess.run(
            ["git", *args],
            cwd=repo_root,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=2,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None

    if result.returncode != 0:
        return None
    output = result.stdout.strip()
    return output or None


def _version_line_number(source: Path) -> int | None:
    try:
        lines = source.read_text(encoding="utf-8").splitlines()
    except OSError:
        return None

    for line_number, line in enumerate(lines, start=1):
        if '"version"' in line:
            return line_number
    return None


def _version_source_commit(source: Path, repo_root: Path) -> str | None:
    line_number = _version_line_number(source)
    if line_number is None:
        return None

    output = _run_git(
        ["blame", "--line-porcelain", f"-L{line_number},{line_number}", "--", _git_path(source, repo_root)],
        repo_root,
    )
    if not output:
        return None

    first_line = output.splitlines()[0].strip()
    commit = first_line.split(" ", 1)[0]
    if commit and not set(commit) == {"0"}:
        return commit
    return None


def _commit_offset_since_version(source: Path, repo_root: Path) -> int:
    source_commit = _version_source_commit(source, repo_root)
    if not source_commit:
        return 0

    output = _run_git(["rev-list", "--count", f"{source_commit}..HEAD"], repo_root)
    if output is None:
        return 0
    try:
        return max(0, int(output))
    except ValueError:
        return 0


def _load_build_version_override(environ: Mapping[str, str] = os.environ) -> str | None:
    version = environ.get(BUILD_VERSION_ENV_KEY, "").strip()
    return version or None


def get_app_version(source: Path = APP_VERSION_SOURCE, repo_root: Path = APP_ROOT, environ: Mapping[str, str] = os.environ) -> str:
    override = _load_build_version_override(environ)
    if override:
        return override

    version = _load_app_version(source)
    commit_offset = _commit_offset_since_version(source, repo_root)
    return _advance_version(version, commit_offset)


APP_VERSION = _load_app_version()
