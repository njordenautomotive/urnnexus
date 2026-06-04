import type {
  HealthResponse,
  ProjectDetailResponse,
  ProjectFilesResponse,
  ProjectListResponse,
  ProjectReportsResponse,
  ApiError,
} from "../types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

function joinPath(base: string, path: string): string {
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

async function readJsonError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as Partial<ApiError> & Record<string, unknown>;
    if (typeof payload.detail === "string" && payload.detail.trim()) {
      return payload.detail;
    }
    if (typeof payload.message === "string" && payload.message.trim()) {
      return payload.message;
    }
  } catch {
    // fall through to generic message
  }
  return `${response.status} ${response.statusText}`;
}

export class ApiRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiRequestError";
  }
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(joinPath(API_BASE, path), {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new ApiRequestError(response.status, await readJsonError(response));
  }

  return (await response.json()) as T;
}

export function projectUrl(projectName: string, suffix = ""): string {
  const encoded = encodeURIComponent(projectName);
  const normalizedSuffix = suffix.startsWith("/") ? suffix : suffix ? `/${suffix}` : "";
  return `/projects/${encoded}${normalizedSuffix}`;
}

export function safeDecodeProjectName(projectName: string | undefined): string {
  if (!projectName) {
    return "";
  }
  try {
    return decodeURIComponent(projectName);
  } catch {
    return projectName;
  }
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) {
    return "—";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 100 ? value.toFixed(0) : value >= 10 ? value.toFixed(1) : value.toFixed(2)} ${units[unitIndex]}`;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("nb-NO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "—";
  }
  const rounded = Math.floor(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;
  if (hours > 0) {
    return `${hours}t ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

export async function getHealth(): Promise<HealthResponse> {
  return fetchJson<HealthResponse>("/health");
}

export async function getProjects(): Promise<ProjectListResponse> {
  return fetchJson<ProjectListResponse>("/projects");
}

export async function getProject(projectName: string): Promise<ProjectDetailResponse> {
  return fetchJson<ProjectDetailResponse>(projectUrl(projectName));
}

export async function getProjectReports(projectName: string): Promise<ProjectReportsResponse> {
  return fetchJson<ProjectReportsResponse>(projectUrl(projectName, "reports"));
}

export async function getProjectFiles(projectName: string): Promise<ProjectFilesResponse> {
  return fetchJson<ProjectFilesResponse>(projectUrl(projectName, "files"));
}

