#!/usr/bin/env python3
from __future__ import annotations

import argparse
import http.client
import json
import logging
import mimetypes
from dataclasses import dataclass
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import ClassVar
from urllib.parse import SplitResult, unquote, urlsplit

LOGGER = logging.getLogger("urn_nexus.frontend_server")
DEFAULT_BACKEND_URL = "http://127.0.0.1:8000"
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 5173
MAX_PROXY_BODY_BYTES = 50 * 1024 * 1024
HOP_BY_HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
}


def _is_within_directory(candidate: Path, root: Path) -> bool:
    try:
        candidate.relative_to(root)
        return True
    except ValueError:
        return False


def _request_path(path: str) -> str:
    return unquote(urlsplit(path).path or "/")


def is_api_request(path: str) -> bool:
    request_path = _request_path(path)
    return request_path == "/api" or request_path.startswith("/api/")


def resolve_static_path(dist_root: Path, request_path: str) -> Path | None:
    root = dist_root.resolve()
    path = _request_path(request_path)
    if path in {"", "/"}:
        index_path = root / "index.html"
        return index_path if index_path.is_file() else None

    relative = Path(path.lstrip("/"))
    candidate = (root / relative).resolve(strict=False)
    if not _is_within_directory(candidate, root):
        return None
    if candidate.is_file():
        return candidate

    if path.endswith("/") and (candidate / "index.html").is_file():
        return candidate / "index.html"

    if "." not in relative.name:
        index_path = root / "index.html"
        return index_path if index_path.is_file() else None

    return None


def _content_type_for(path: Path) -> str:
    guess, _ = mimetypes.guess_type(path.name)
    return guess or "application/octet-stream"


def _json_bytes(payload: dict[str, object]) -> bytes:
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


@dataclass(slots=True)
class FrontendRuntimeConfig:
    dist_root: Path
    backend_url: SplitResult


class FrontendRuntimeServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, server_address: tuple[str, int], config: FrontendRuntimeConfig) -> None:
        super().__init__(server_address, FrontendRequestHandler)
        self.config = config


class FrontendRequestHandler(BaseHTTPRequestHandler):
    server_version = "URNNexusFrontend/1.0"
    protocol_version = "HTTP/1.1"

    @property
    def runtime_config(self) -> FrontendRuntimeConfig:
        return self.server.config  # type: ignore[return-value]

    def do_GET(self) -> None:  # noqa: N802
        self._dispatch(send_body=True)

    def do_HEAD(self) -> None:  # noqa: N802
        self._dispatch(send_body=False)

    def do_POST(self) -> None:  # noqa: N802
        self._dispatch(send_body=True)

    def do_PUT(self) -> None:  # noqa: N802
        self._dispatch(send_body=True)

    def do_PATCH(self) -> None:  # noqa: N802
        self._dispatch(send_body=True)

    def do_DELETE(self) -> None:  # noqa: N802
        self._dispatch(send_body=True)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self._dispatch(send_body=True)

    def _dispatch(self, *, send_body: bool) -> None:
        if _request_path(self.path) in {"/__health", "/__healthz"}:
            self._write_health(send_body=send_body)
            return

        if is_api_request(self.path):
            self._proxy_api(send_body=send_body)
            return

        if self.command not in {"GET", "HEAD"}:
            self._write_json_error(HTTPStatus.METHOD_NOT_ALLOWED, "frontend_method_not_allowed", "Frontend server only serves static assets.")
            return

        self._serve_static(send_body=send_body)

    def _write_health(self, *, send_body: bool) -> None:
        dist_root = self.runtime_config.dist_root.resolve()
        index_path = dist_root / "index.html"
        payload = {
            "status": "ok" if index_path.is_file() else "degraded",
            "dist_root": str(dist_root),
            "index_exists": index_path.is_file(),
            "backend": self._backend_base_url(),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        body = _json_bytes(payload)
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if send_body:
            self.wfile.write(body)

    def _serve_static(self, *, send_body: bool) -> None:
        file_path = resolve_static_path(self.runtime_config.dist_root, self.path)
        if file_path is None:
            self._write_json_error(HTTPStatus.NOT_FOUND, "frontend_not_found", "Den forespurte frontend-siden finnes ikke.")
            return

        try:
            stat_result = file_path.stat()
        except FileNotFoundError:
            self._write_json_error(HTTPStatus.NOT_FOUND, "frontend_not_found", "Frontend-filen finnes ikke lenger.")
            return

        content_type = _content_type_for(file_path)
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(stat_result.st_size))
        if file_path.name == "index.html":
            self.send_header("Cache-Control", "no-cache")
        else:
            self.send_header("Cache-Control", "public, max-age=3600")
        self.end_headers()
        if not send_body:
            return

        with file_path.open("rb") as handle:
            while True:
                chunk = handle.read(64 * 1024)
                if not chunk:
                    break
                self.wfile.write(chunk)

    def _proxy_api(self, *, send_body: bool) -> None:
        backend = self.runtime_config.backend_url
        body = self._read_request_body()
        if len(body) > MAX_PROXY_BODY_BYTES:
            self._write_json_error(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, "proxy_body_too_large", "Request body er for stor for frontend-proxyen.")
            return

        headers = self._forward_headers()
        connection_cls = http.client.HTTPSConnection if backend.scheme == "https" else http.client.HTTPConnection
        connection = connection_cls(backend.hostname or "127.0.0.1", backend.port or (443 if backend.scheme == "https" else 80), timeout=30)
        try:
            upstream_path = self._upstream_path(backend, self.path)
            connection.request(self.command, upstream_path, body=body or None, headers=headers)
            upstream_response = connection.getresponse()
        except OSError as exc:
            LOGGER.exception("Frontend proxy could not reach backend: %s", exc)
            self._write_json_error(HTTPStatus.BAD_GATEWAY, "backend_unreachable", f"Backend er ikke tilgjengelig: {exc}")
            return

        try:
            self.send_response(upstream_response.status, upstream_response.reason)
            content_length = upstream_response.getheader("Content-Length")
            for key, value in upstream_response.getheaders():
                lower_key = key.lower()
                if lower_key in HOP_BY_HOP_HEADERS or lower_key == "content-length":
                    continue
                self.send_header(key, value)
            if content_length is not None:
                self.send_header("Content-Length", content_length)
            self.end_headers()

            if send_body and self.command != "HEAD":
                while True:
                    chunk = upstream_response.read(64 * 1024)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
        finally:
            upstream_response.close()
            connection.close()

    def _forward_headers(self) -> dict[str, str]:
        forwarded: dict[str, str] = {}
        for key, value in self.headers.items():
            lower_key = key.lower()
            if lower_key in {"host", "connection", "content-length", "transfer-encoding", "proxy-connection", "accept-encoding"}:
                continue
            forwarded[key] = value
        forwarded["Accept-Encoding"] = "identity"
        forwarded["X-Forwarded-Proto"] = "http"
        forwarded["X-Forwarded-Host"] = self.headers.get("Host", self.server.server_address[0])  # type: ignore[attr-defined]
        return forwarded

    def _read_request_body(self) -> bytes:
        transfer_encoding = self.headers.get("Transfer-Encoding", "").lower()
        if "chunked" in transfer_encoding:
            return self._read_chunked_request_body()

        content_length = self.headers.get("Content-Length")
        if not content_length:
            return b""
        try:
            size = int(content_length)
        except ValueError:
            return b""
        if size <= 0:
            return b""
        return self.rfile.read(size)

    def _read_chunked_request_body(self) -> bytes:
        chunks: list[bytes] = []
        while True:
            size_line = self.rfile.readline()
            if not size_line:
                break
            size_token = size_line.split(b";", 1)[0].strip()
            try:
                size = int(size_token, 16)
            except ValueError:
                break
            if size == 0:
                while True:
                    trailer_line = self.rfile.readline()
                    if trailer_line in {b"\r\n", b"\n", b""}:
                        break
                break
            chunk = self.rfile.read(size)
            chunks.append(chunk)
            self.rfile.read(2)
        return b"".join(chunks)

    def _backend_base_url(self) -> str:
        backend = self.runtime_config.backend_url
        port = backend.port or (443 if backend.scheme == "https" else 80)
        return f"{backend.scheme}://{backend.hostname}:{port}"

    def _upstream_path(self, backend: SplitResult, request_path: str) -> str:
        backend_prefix = backend.path.rstrip("/")
        request = urlsplit(request_path)
        upstream = request.path
        if backend_prefix:
            upstream = f"{backend_prefix}{upstream}" if upstream.startswith("/") else f"{backend_prefix}/{upstream}"
        if request.query:
            upstream = f"{upstream}?{request.query}"
        return upstream

    def _write_json_error(self, status: HTTPStatus, code: str, detail: str) -> None:
        body = _json_bytes({"code": code, "detail": detail})
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def log_message(self, format: str, *args: object) -> None:  # noqa: A003
        LOGGER.info("%s - %s", self.address_string(), format % args)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Serve the built URN Nexus frontend dist and proxy /api to the backend.")
    parser.add_argument("--dist", type=Path, default=Path(__file__).resolve().parents[1] / "frontend" / "dist", help="Path to the built frontend dist directory.")
    parser.add_argument("--backend", default=DEFAULT_BACKEND_URL, help="Backend base URL, for example http://127.0.0.1:8000.")
    parser.add_argument("--host", default=DEFAULT_HOST, help="Bind host for the frontend server.")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Bind port for the frontend server.")
    parser.add_argument("--log-level", default="INFO", help="Logging level for the frontend server.")
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    logging.basicConfig(level=getattr(logging, str(args.log_level).upper(), logging.INFO), format="%(asctime)s %(levelname)s %(name)s %(message)s")

    dist_root = args.dist.expanduser().resolve()
    if not dist_root.exists():
        LOGGER.error("Frontend dist directory does not exist: %s", dist_root)
        return 1

    index_path = dist_root / "index.html"
    if not index_path.is_file():
        LOGGER.error("Frontend dist is missing index.html: %s", index_path)
        return 1

    backend_url = urlsplit(args.backend)
    if backend_url.scheme not in {"http", "https"} or not backend_url.hostname:
        LOGGER.error("Invalid backend URL: %s", args.backend)
        return 1

    server = FrontendRuntimeServer(
        (args.host, args.port),
        FrontendRuntimeConfig(dist_root=dist_root, backend_url=backend_url),
    )
    LOGGER.info("Serving frontend dist from %s on http://%s:%s", dist_root, args.host, args.port)
    LOGGER.info("Proxying /api requests to %s", args.backend)

    try:
        server.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        LOGGER.info("Frontend server interrupted, shutting down.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
