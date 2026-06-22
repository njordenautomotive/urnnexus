from __future__ import annotations

import json
import os
from pathlib import Path
from collections.abc import Mapping

APP_ROOT = Path(__file__).resolve().parents[2]
APP_VERSION_SOURCE = APP_ROOT / "frontend" / "package.json"
COMMIT_ENV_KEYS = (
    "URN_NEXUS_BUILD_COMMIT",
    "GIT_COMMIT",
    "VERCEL_GIT_COMMIT_SHA",
    "COMMIT_SHA",
    "SOURCE_VERSION",
)


def _load_app_version(source: Path = APP_VERSION_SOURCE) -> str:
    try:
        payload = json.loads(source.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return "0.0.0+unknown"

    version = payload.get("version")
    if isinstance(version, str) and version.strip():
        return version.strip()
    return "0.0.0+unknown"


def _short_commit(value: str | None) -> str | None:
    commit = (value or "").strip()
    if not commit:
        return None
    return commit[:12]


def _git_dir(repo_root: Path = APP_ROOT) -> Path | None:
    git_path = repo_root / ".git"
    if git_path.is_dir():
        return git_path
    if not git_path.is_file():
        return None

    try:
        marker = git_path.read_text(encoding="utf-8").strip()
    except OSError:
        return None

    prefix = "gitdir:"
    if not marker.lower().startswith(prefix):
        return None

    raw_path = marker[len(prefix) :].strip()
    resolved = Path(raw_path)
    if not resolved.is_absolute():
        resolved = git_path.parent / resolved
    return resolved


def _read_packed_ref(git_dir: Path, ref_name: str) -> str | None:
    packed_refs = git_dir / "packed-refs"
    try:
        lines = packed_refs.read_text(encoding="utf-8").splitlines()
    except OSError:
        return None

    suffix = f" {ref_name}"
    for line in lines:
        if line.startswith("#") or line.startswith("^"):
            continue
        if line.endswith(suffix):
            return _short_commit(line.split(" ", 1)[0])
    return None


def _read_git_commit(repo_root: Path = APP_ROOT) -> str | None:
    git_dir = _git_dir(repo_root)
    if git_dir is None:
        return None

    try:
        head = (git_dir / "HEAD").read_text(encoding="utf-8").strip()
    except OSError:
        return None

    if head.startswith("ref:"):
        ref_name = head.removeprefix("ref:").strip()
        try:
            return _short_commit((git_dir / ref_name).read_text(encoding="utf-8"))
        except OSError:
            return _read_packed_ref(git_dir, ref_name)

    return _short_commit(head)


def _load_commit_from_env(environ: Mapping[str, str] = os.environ) -> str | None:
    for key in COMMIT_ENV_KEYS:
        commit = _short_commit(environ.get(key))
        if commit:
            return commit
    return None


def _version_with_commit(version: str, commit: str) -> str:
    separator = "." if "+" in version else "+"
    return f"{version}{separator}{commit}"


def get_app_version(source: Path = APP_VERSION_SOURCE, repo_root: Path = APP_ROOT, environ: Mapping[str, str] = os.environ) -> str:
    version = _load_app_version(source)
    commit = _load_commit_from_env(environ) or _read_git_commit(repo_root) or "unknown"
    return _version_with_commit(version, commit)


APP_VERSION = _load_app_version()
