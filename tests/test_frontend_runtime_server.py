from __future__ import annotations

from pathlib import Path

from scripts.serve_frontend_dist import is_api_request, resolve_static_path


def test_is_api_request_detects_proxy_paths() -> None:
    assert is_api_request("/api/health")
    assert is_api_request("/api/projects?include_local_cache=true")
    assert not is_api_request("/health")
    assert not is_api_request("/assets/app.js")


def test_resolve_static_path_supports_spa_fallback_and_assets(tmp_path: Path) -> None:
    dist_root = tmp_path / "dist"
    assets_dir = dist_root / "assets"
    assets_dir.mkdir(parents=True)
    (dist_root / "index.html").write_text("<!doctype html><html></html>", encoding="utf-8")
    bundle = assets_dir / "app-123.js"
    bundle.write_text("console.log('ok');", encoding="utf-8")

    assert resolve_static_path(dist_root, "/") == dist_root / "index.html"
    assert resolve_static_path(dist_root, "/projects/Olav%20Tryggvasons") == dist_root / "index.html"
    assert resolve_static_path(dist_root, "/assets/app-123.js") == bundle
    assert resolve_static_path(dist_root, "/assets/missing.js") is None
    assert resolve_static_path(dist_root, "/../secrets.txt") is None
