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
  display_name: string;
  source_label: string;
  relative_project_path: string;
  hidden_internal_path: string;
  last_synced_at: string | null;
  latest_comment_document: string | null;
  latest_comment_document_open_url: string | null;
  latest_comment_modified_at: string | null;
  comment_document_count: number;
  is_sample_project: boolean;
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
  report_id: string;
  report_name: string;
  report_path: string;
  report_type: string;
  modified_at: string;
  size_bytes: number;
  is_latest: boolean;
  open_url: string;
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
  display_name: string;
  source_label: string;
  relative_project_path: string;
  hidden_internal_path: string;
  last_synced_at: string | null;
  latest_comment_document: string | null;
  latest_comment_document_open_url: string | null;
  latest_comment_modified_at: string | null;
  comment_document_count: number;
  is_sample_project: boolean;
  project_name: string;
  project_path: string;
  total_files: number;
  file_tree: FileNode;
  filters: FileFilters;
  warnings: string[];
  errors: string[];
}

export interface ProjectReportsResponse {
  display_name: string;
  source_label: string;
  relative_project_path: string;
  hidden_internal_path: string;
  last_synced_at: string | null;
  latest_comment_document: string | null;
  latest_comment_document_open_url: string | null;
  latest_comment_modified_at: string | null;
  comment_document_count: number;
  is_sample_project: boolean;
  project_name: string;
  project_path: string;
  count: number;
  reports: ProjectReport[];
  warnings: string[];
  errors: string[];
}

export interface ProjectDetailResponse extends ProjectSummary {
  analysis: ProjectAnalysisInfo | null;
  reports: ProjectReport[];
}

export interface ProjectDebugPathsResponse {
  project_name: string;
  resolved_project_path: string;
  project_path_exists: boolean;
  total_files_on_disk: number;
  counted_source_files: number;
  comment_documents_found: number;
  first_20_files_on_disk: string[];
  ignored_file_count: number;
  ignored_reasons: string[];
}
