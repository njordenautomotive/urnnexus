from __future__ import annotations

import logging
import re

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import FileResponse

from backend.app.models.health import HealthResponse
from backend.app.models.operations import (
    FileUploadResponse,
    FolderCreateRequest,
    FolderCreateResponse,
    ProjectCreateRequest,
    ProjectCreateResponse,
    ProjectDeleteResponse,
    ProjectLocalCacheDeleteResponse,
    SyncRunResponse,
    SyncStatusResponse,
)
from backend.app.models.project import (
    ProjectDebugPathsResponse,
    ProjectDetailResponse,
    ProjectListResponse,
    ProjectReportsResponse,
)
from backend.app.models.files import ProjectFilesResponse
from backend.app.services.appliance import ApplianceService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["appliance"])


def _report_media_type(filename: str) -> str:
    suffix = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if suffix == "docx":
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    if suffix == "pdf":
        return "application/pdf"
    return "application/octet-stream"


def _file_media_type(filename: str) -> str:
    suffix = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if suffix == "pdf":
        return "application/pdf"
    if suffix == "docx":
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    if suffix == "xlsx":
        return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    if suffix in {"jpg", "jpeg"}:
        return "image/jpeg"
    if suffix == "png":
        return "image/png"
    if suffix == "txt":
        return "text/plain; charset=utf-8"
    return "application/octet-stream"


_FORM_NAME_RE = re.compile(r'name="([^"]+)"')
_FORM_FILENAME_RE = re.compile(r'filename="([^"]*)"')


def _parse_multipart_upload(content_type: str, body: bytes) -> tuple[str, bytes, str | None]:
    match = re.search(r'boundary="?([^";]+)"?', content_type)
    if match is None:
        raise ValueError("Upload must be multipart/form-data.")
    boundary = f"--{match.group(1)}".encode("utf-8")
    filename = ""
    file_content: bytes | None = None
    target_folder: str | None = None

    for raw_part in body.split(boundary):
        part = raw_part
        if part.startswith(b"\r\n"):
            part = part[2:]
        if part.endswith(b"--\r\n"):
            part = part[:-4]
        elif part.endswith(b"--"):
            part = part[:-2]
        if part.endswith(b"\r\n"):
            part = part[:-2]
        if not part or part == b"--":
            continue
        header_blob, separator, content = part.partition(b"\r\n\r\n")
        if not separator:
            continue
        headers = header_blob.decode("utf-8", errors="replace")
        name_match = _FORM_NAME_RE.search(headers)
        if name_match is None:
            continue
        field_name = name_match.group(1)
        if field_name == "target_folder":
            target_folder = content.decode("utf-8", errors="replace").strip() or None
            continue
        if field_name == "file":
            filename_match = _FORM_FILENAME_RE.search(headers)
            filename = filename_match.group(1).strip() if filename_match else ""
            file_content = content

    if not filename or file_content is None:
        raise ValueError("Multipart upload must contain a file field.")
    return filename, file_content, target_folder


def get_service(request: Request) -> ApplianceService:
    return request.app.state.appliance_service


@router.get("/health", response_model=HealthResponse)
def health(service: ApplianceService = Depends(get_service)) -> HealthResponse:
    return service.health()


@router.get("/projects", response_model=ProjectListResponse)
def list_projects(
    include_local_cache: bool = Query(False),
    service: ApplianceService = Depends(get_service),
) -> ProjectListResponse:
    return service.list_projects(include_local_cache=include_local_cache)


@router.post("/projects", response_model=ProjectCreateResponse)
def create_project(payload: ProjectCreateRequest, service: ApplianceService = Depends(get_service)) -> ProjectCreateResponse:
    return service.create_project(payload.project_name, folders=payload.folders)


@router.delete("/projects/{project_name}", response_model=ProjectDeleteResponse)
def delete_project(project_name: str, service: ApplianceService = Depends(get_service)) -> ProjectDeleteResponse:
    return service.delete_project(project_name)


@router.delete("/projects/{project_name}/local-cache", response_model=ProjectLocalCacheDeleteResponse)
def delete_project_local_cache(project_name: str, service: ApplianceService = Depends(get_service)) -> ProjectLocalCacheDeleteResponse:
    return service.delete_project_local_cache(project_name)


@router.post("/sync/run", response_model=SyncRunResponse)
def run_sync(service: ApplianceService = Depends(get_service)) -> SyncRunResponse:
    return service.start_sync()


@router.get("/sync/status", response_model=SyncStatusResponse)
def sync_status(service: ApplianceService = Depends(get_service)) -> SyncStatusResponse:
    return service.sync_status()


@router.get("/projects/{project_name}", response_model=ProjectDetailResponse)
def get_project(project_name: str, service: ApplianceService = Depends(get_service)) -> ProjectDetailResponse:
    return service.get_project(project_name)


@router.get("/projects/{project_name}/reports", response_model=ProjectReportsResponse)
def get_reports(project_name: str, service: ApplianceService = Depends(get_service)) -> ProjectReportsResponse:
    return service.list_reports(project_name)


@router.get("/projects/{project_name}/reports/{report_id}/open")
def open_report(project_name: str, report_id: str, service: ApplianceService = Depends(get_service)) -> FileResponse:
    report = service.open_report(project_name, report_id)
    return FileResponse(
        report.report_path,
        filename=report.report_name,
        media_type=_report_media_type(report.report_name),
        content_disposition_type="inline",
    )


@router.get("/projects/{project_name}/reports/{report_id}/download")
def download_report(project_name: str, report_id: str, service: ApplianceService = Depends(get_service)) -> FileResponse:
    report = service.open_report(project_name, report_id)
    return FileResponse(
        report.report_path,
        filename=report.report_name,
        media_type=_report_media_type(report.report_name),
        content_disposition_type="attachment",
    )


@router.get("/projects/{project_name}/files", response_model=ProjectFilesResponse)
def get_files(project_name: str, service: ApplianceService = Depends(get_service)) -> ProjectFilesResponse:
    return service.list_files(project_name)


@router.get("/projects/{project_name}/files/open")
def open_file(
    project_name: str,
    path: str = Query(..., min_length=1),
    service: ApplianceService = Depends(get_service),
) -> FileResponse:
    file_path, filename = service.resolve_project_file(project_name, path)
    return FileResponse(file_path, filename=filename, media_type=_file_media_type(filename), content_disposition_type="inline")


@router.get("/projects/{project_name}/files/download")
def download_file(
    project_name: str,
    path: str = Query(..., min_length=1),
    service: ApplianceService = Depends(get_service),
) -> FileResponse:
    file_path, filename = service.resolve_project_file(project_name, path)
    return FileResponse(file_path, filename=filename, media_type=_file_media_type(filename), content_disposition_type="attachment")


@router.post("/projects/{project_name}/files/upload", response_model=FileUploadResponse)
async def upload_file(project_name: str, request: Request, service: ApplianceService = Depends(get_service)) -> FileUploadResponse:
    filename, content, form_target_folder = _parse_multipart_upload(request.headers.get("content-type", ""), await request.body())
    target_folder = request.query_params.get("target_folder") or form_target_folder
    return service.upload_file(project_name, filename, content, target_folder=target_folder)


@router.post("/projects/{project_name}/files/folders", response_model=FolderCreateResponse)
def create_folder(project_name: str, payload: FolderCreateRequest, service: ApplianceService = Depends(get_service)) -> FolderCreateResponse:
    return service.create_project_folder(project_name, payload.folder_name, target_folder=payload.target_folder)


@router.get("/projects/{project_name}/debug-paths", response_model=ProjectDebugPathsResponse)
def get_debug_paths(project_name: str, service: ApplianceService = Depends(get_service)) -> ProjectDebugPathsResponse:
    return service.debug_paths(project_name)
