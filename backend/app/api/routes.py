from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import FileResponse

from backend.app.models.health import HealthResponse
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


def get_service(request: Request) -> ApplianceService:
    return request.app.state.appliance_service


@router.get("/health", response_model=HealthResponse)
def health(service: ApplianceService = Depends(get_service)) -> HealthResponse:
    return service.health()


@router.get("/projects", response_model=ProjectListResponse)
def list_projects(service: ApplianceService = Depends(get_service)) -> ProjectListResponse:
    return service.list_projects()


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
    )


@router.get("/projects/{project_name}/files", response_model=ProjectFilesResponse)
def get_files(project_name: str, service: ApplianceService = Depends(get_service)) -> ProjectFilesResponse:
    return service.list_files(project_name)


@router.get("/projects/{project_name}/debug-paths", response_model=ProjectDebugPathsResponse)
def get_debug_paths(project_name: str, service: ApplianceService = Depends(get_service)) -> ProjectDebugPathsResponse:
    return service.debug_paths(project_name)
