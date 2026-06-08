import type {
  HealthResponse,
  FileUploadResponse,
  FolderCreateRequest,
  FolderCreateResponse,
  ProjectCreateRequest,
  ProjectCreateResponse,
  ProjectDeleteResponse,
  ProjectLocalCacheDeleteResponse,
  ProjectDetailResponse,
  ProjectFilesResponse,
  ProjectListResponse,
  ProjectReportsResponse,
  SyncRunResponse,
  SyncStatusResponse,
  ApiError,
} from "../types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";
const REQUEST_TIMEOUT_MS = 30_000;

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
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(joinPath(API_BASE, path), {
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ApiRequestError(response.status, await readJsonError(response));
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiRequestError(408, "API-kallet tok for lang tid.");
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

async function sendJson<T>(path: string, payload?: unknown): Promise<T> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(joinPath(API_BASE, path), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: payload === undefined ? undefined : JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ApiRequestError(response.status, await readJsonError(response));
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiRequestError(408, "API-kallet tok for lang tid.");
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

async function deleteJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(joinPath(API_BASE, path), {
      method: "DELETE",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ApiRequestError(response.status, await readJsonError(response));
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiRequestError(408, "API-kallet tok for lang tid.");
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

async function sendForm<T>(path: string, formData: FormData): Promise<T> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(joinPath(API_BASE, path), {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ApiRequestError(response.status, await readJsonError(response));
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiRequestError(408, "API-kallet tok for lang tid.");
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

export function projectUrl(projectName: string, suffix = ""): string {
  const encoded = encodeURIComponent(projectName);
  const normalizedSuffix = suffix.startsWith("/") ? suffix : suffix ? `/${suffix}` : "";
  return `/projects/${encoded}${normalizedSuffix}`;
}

function withQuery(path: string, params: Record<string, string | boolean | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue;
    }
    searchParams.set(key, String(value));
  }
  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
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

export async function getProjects(options?: { includeSampleProjects?: boolean }): Promise<ProjectListResponse> {
  return fetchJson<ProjectListResponse>(
    withQuery("/projects", {
      include_sample_projects: options?.includeSampleProjects,
    }),
  );
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

export async function createProject(payload: ProjectCreateRequest): Promise<ProjectCreateResponse> {
  return sendJson<ProjectCreateResponse>("/projects", payload);
}

export async function deleteProject(projectName: string): Promise<ProjectDeleteResponse> {
  return deleteJson<ProjectDeleteResponse>(projectUrl(projectName));
}

export async function deleteProjectLocalCache(projectName: string): Promise<ProjectLocalCacheDeleteResponse> {
  return deleteJson<ProjectLocalCacheDeleteResponse>(projectUrl(projectName, "local-cache"));
}

export async function uploadProjectFile(projectName: string, file: File, targetFolder: string): Promise<FileUploadResponse> {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("target_folder", targetFolder);
  return sendForm<FileUploadResponse>(projectUrl(projectName, "files/upload"), formData);
}

export async function createProjectFolder(projectName: string, payload: FolderCreateRequest): Promise<FolderCreateResponse> {
  return sendJson<FolderCreateResponse>(projectUrl(projectName, "files/folders"), payload);
}

export async function runSync(): Promise<SyncRunResponse> {
  return sendJson<SyncRunResponse>("/sync/run");
}

export async function getSyncStatus(): Promise<SyncStatusResponse> {
  return fetchJson<SyncStatusResponse>("/sync/status");
}
