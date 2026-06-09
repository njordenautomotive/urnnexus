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
  last_synced_at: string | null;
  last_analyzed_at: string | null;
  latest_report_generated_at: string | null;
  project_count: number;
  file_count: number;
  report_count: number;
  one_drive_status: string;
  one_drive_detail: string | null;
  graph_write_status: string;
  graph_write_detail: string | null;
  openai_status: string;
  openai_detail: string | null;
  smtp_status: string;
  smtp_detail: string | null;
  disk_total_bytes: number | null;
  disk_used_bytes: number | null;
  disk_free_bytes: number | null;
  cache_size_bytes: number | null;
  errors_last_24h: number;
  warnings_last_24h: number;
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
  latest_comment_created_at: string | null;
  latest_comment_modified_at: string | null;
  comment_document_count: number;
  is_sample_project: boolean;
  is_local_cache_only?: boolean;
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
  version: string | null;
  created_at: string | null;
  generated_at: string | null;
  modified_at: string;
  size_bytes: number;
  is_latest: boolean;
  open_url: string;
  download_url: string;
}

export interface CountFacet {
  value: string;
  label: string;
  count: number;
}

export interface FileNode {
  name: string;
  path: string;
  relative_path?: string;
  display_name?: string;
  kind: "folder" | "file";
  file_count: number;
  folder_category: string | null;
  extension: string | null;
  size_bytes: number | null;
  modified_at: string | null;
  open_url?: string | null;
  download_url?: string | null;
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
  latest_comment_created_at: string | null;
  latest_comment_modified_at: string | null;
  comment_document_count: number;
  is_sample_project: boolean;
  is_local_cache_only?: boolean;
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
  latest_comment_created_at: string | null;
  latest_comment_modified_at: string | null;
  comment_document_count: number;
  is_sample_project: boolean;
  is_local_cache_only?: boolean;
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

export interface ProjectCreateRequest {
  project_name: string;
  template?: string | null;
  folders?: string[];
}

export interface ProjectCreateResponse {
  project_name: string;
  relative_project_path: string;
  mode: "onedrive";
  folders_created: string[];
  warning: string | null;
}

export interface ProjectLocalCacheDeleteResponse {
  project_name: string;
  hidden: boolean;
  removed_paths: string[];
  removed_state_rows: number;
  message: string;
}

export interface ProjectDeleteResponse {
  project_name: string;
  deleted_remote_path: string;
  deleted: boolean;
  existed: boolean;
  synced: boolean;
  message: string;
}

export interface FileUploadResponse {
  project_name: string;
  filename: string;
  target_folder: string;
  relative_path: string;
  size_bytes: number;
  mode: "onedrive" | "local_cache_only";
  warning: string | null;
}

export interface FolderCreateRequest {
  folder_name: string;
  target_folder?: string | null;
}

export interface FolderCreateResponse {
  project_name: string;
  folder_name: string;
  target_folder: string;
  relative_path: string;
  mode: "onedrive" | "local_cache_only";
  warning: string | null;
}

export interface SyncRunResponse {
  job_id: string;
  running: boolean;
  started_at: string;
  status: string;
  sync_only: boolean;
  analysis_started: boolean;
  reports_generated: number;
  projects_synced: number;
  files_changed: number;
  reports_found: number;
}

export interface SyncStatusResponse {
  running: boolean;
  job_id: string | null;
  last_started_at: string | null;
  last_completed_at: string | null;
  last_error: string | null;
  projects_synced: number;
  files_changed: number;
  reports_found: number;
  status: string;
}

export interface AnalysisRunRequest {
  project_name?: string | null;
  email_mode: "daily_digest" | "immediate";
}

export interface AnalysisRunResponse {
  job_id: string;
  running: boolean;
  started_at: string;
  status: string;
  analysis_started: boolean;
  reports_generated: number;
  projects_synced: number;
  files_changed: number;
  reports_found: number;
  email_mode: "daily_digest" | "immediate";
  project_name: string | null;
}

export interface AnalysisStatusResponse {
  running: boolean;
  job_id: string | null;
  last_started_at: string | null;
  last_completed_at: string | null;
  last_error: string | null;
  projects_synced: number;
  files_changed: number;
  reports_found: number;
  reports_generated: number;
  email_mode: "daily_digest" | "immediate" | null;
  project_name: string | null;
  status: string;
  analysis_started: boolean;
}
