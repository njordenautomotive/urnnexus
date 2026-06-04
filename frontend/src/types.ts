export type ApiStatus = "unknown" | "skipped_no_changes" | "completed" | "completed_with_warnings" | "failed" | string;

export interface ApiError {
  code: string;
  detail: string;
}

export interface HealthResponse {
  appliance_available: boolean;
  uptime_seconds: number;
  uptime: string;
  version: string | null;
  appliance_root: string;
  discovered_projects: number;
}

export interface ProjectSummary {
  project_name: string;
  project_path: string;
  last_analyzed_at: string | null;
  status: ApiStatus;
  file_count: number;
  report_count: number;
  warnings: string[];
  errors: string[];
}

export interface ProjectListResponse {
  count: number;
  projects: ProjectSummary[];
  warnings: string[];
}

export interface ProjectAnalysisInfo {
  status: ApiStatus;
  last_analyzed_at: string | null;
  provider: string | null;
  model: string | null;
  documents_seen: number | null;
  chunks_created: number | null;
  report_items_count: number | null;
  output_docx_path: string | null;
  run_summary_path: string | null;
  warnings_count: number;
  errors_count: number;
}

export interface ProjectReport {
  report_name: string;
  report_path: string;
  report_type: string;
  modified_at: string;
  size_bytes: number;
  is_latest: boolean;
}

export interface CountFacet {
  value: string;
  label: string;
  count: number;
}

export interface FileNode {
  name: string;
  path: string;
  kind: "folder" | "file";
  file_count: number;
  folder_category: string | null;
  extension: string | null;
  size_bytes: number | null;
  modified_at: string | null;
  children: FileNode[];
}

export interface FileFilters {
  folder_categories: CountFacet[];
  extensions: CountFacet[];
}

export interface ProjectFilesResponse {
  project_name: string;
  project_path: string;
  total_files: number;
  file_tree: FileNode;
  filters: FileFilters;
  warnings: string[];
  errors: string[];
}

export interface ProjectReportsResponse {
  project_name: string;
  project_path: string;
  count: number;
  reports: ProjectReport[];
  warnings: string[];
  errors: string[];
}

export interface ProjectDetailResponse {
  project_name: string;
  project_path: string;
  last_analyzed_at: string | null;
  status: ApiStatus;
  file_count: number;
  report_count: number;
  warnings: string[];
  errors: string[];
  analysis: ProjectAnalysisInfo | null;
  reports: ProjectReport[];
}

