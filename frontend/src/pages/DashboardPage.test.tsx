import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { describe, expect, it } from "vitest";
import { AppDataContext } from "../context/AppDataContext";
import { formatDateTime } from "../lib/api";
import { createProjectViewModel } from "../lib/projects";
import type { HealthResponse, ProjectSummary, SyncStatusResponse } from "../types";
import { DashboardPage, resolveDashboardLastSyncedAt } from "./DashboardPage";

function makeProject(overrides: Partial<ProjectSummary>): ProjectSummary {
  return {
    project_name: "Bryn Skole",
    display_name: "Bryn Skole",
    source_label: "OneDrive",
    relative_project_path: "AnbudAppliance/Urban_Reuse_Norway/Bryn Skole",
    hidden_internal_path: "/home/anbudklient/appliance/.riveanbud_runtime/Bryn Skole",
    last_synced_at: "2026-06-04T08:00:00+02:00",
    latest_comment_document: "Bryn Skole - Kommentardokument.docx",
    latest_comment_document_open_url: "/api/projects/Bryn%20Skole/reports/latest/open",
    latest_comment_created_at: "2026-06-04T08:15:00+02:00",
    latest_comment_modified_at: "2026-06-04T08:15:00+02:00",
    comment_document_count: 1,
    is_sample_project: false,
    project_path: "/home/anbudklient/appliance/.riveanbud_runtime/Bryn Skole",
    last_analyzed_at: "2026-06-04T08:15:00+02:00",
    status: "completed_with_warnings",
    file_count: 395,
    report_count: 1,
    warnings: [],
    errors: [],
    ...overrides,
  };
}

const health: HealthResponse = {
  appliance_available: true,
  uptime_seconds: 120,
  uptime: "0:02:00",
  version: "0.1.5",
  appliance_root: "/home/anbudklient/appliance",
  discovered_projects: 2,
  last_synced_at: "2026-06-08T18:03:00+02:00",
  last_analyzed_at: "2026-06-04T08:15:00+02:00",
  latest_report_generated_at: "2026-06-04T08:15:00+02:00",
  project_count: 2,
  file_count: 395,
  report_count: 1,
  one_drive_status: "available",
  one_drive_detail: "2 prosjekter funnet i lokal OneDrive-cache.",
  graph_write_status: "configured",
  graph_write_detail: "Microsoft Graph-write er konfigurert for direkte OneDrive-opprettelse.",
  openai_status: "configured",
  openai_detail: "OPENAI_API_KEY er satt.",
  smtp_status: "not_configured",
  smtp_detail: "SMTP_HOST mangler.",
  disk_total_bytes: 1000,
  disk_used_bytes: 500,
  disk_free_bytes: 500,
  cache_size_bytes: 250,
  errors_last_24h: 0,
  warnings_last_24h: 0,
};

describe("DashboardPage", () => {
  it("prefers the completed sync timestamp over health for the top sync display", () => {
    const syncStatus: SyncStatusResponse = {
      running: false,
      job_id: "sync-job",
      last_started_at: "2026-06-09T08:45:00+02:00",
      last_completed_at: "2026-06-09T08:49:00+02:00",
      last_error: null,
      projects_synced: 2,
      files_changed: 4,
      reports_found: 1,
      status: "completed",
    };

    expect(resolveDashboardLastSyncedAt(syncStatus, health)).toBe("2026-06-09T08:49:00+02:00");
    expect(formatDateTime(resolveDashboardLastSyncedAt(syncStatus, health))).toBe(formatDateTime("2026-06-09T08:49:00+02:00"));
  });

  it("shows dashboard metrics and direct latest report actions without internal paths", () => {
    const projectWithReport = createProjectViewModel(makeProject({}));
    const projectWithoutReport = createProjectViewModel(
      makeProject({
        project_name: "No Comment",
        display_name: "No Comment",
        relative_project_path: "AnbudAppliance/Urban_Reuse_Norway/No Comment",
        latest_comment_document: null,
        latest_comment_document_open_url: null,
        latest_comment_created_at: null,
        latest_comment_modified_at: null,
        comment_document_count: 0,
        report_count: 0,
        status: "pending",
      }),
    );

    const markup = renderToStaticMarkup(
      <StaticRouter location="/">
        <AppDataContext.Provider
          value={{
            projects: [projectWithReport, projectWithoutReport],
            projectsLoading: false,
            projectsError: null,
            projectWarnings: [],
            health,
            healthLoading: false,
            healthError: null,
            refresh: () => undefined,
            removeProjectByName: () => undefined,
          }}
        >
          <DashboardPage />
        </AppDataContext.Provider>
      </StaticRouter>,
    );

    expect(markup).toContain("Prosjekter totalt");
    expect(markup).toContain("Uten rapport");
    expect(markup).toContain("Synk OneDrive");
    expect(markup).toContain("Henter filer og rapportliste fra OneDrive. Genererer ikke rapport.");
    expect(markup).toContain("Kontrollsenter");
    expect(markup).not.toContain("page-header__eyebrow");
    expect(markup).not.toContain("URN Nexus");
    expect(markup).toContain("Sist synk fullført");
    expect(markup).toContain(formatDateTime(health.last_synced_at));
    expect(markup).not.toContain("Generer rapport");
    expect(markup).toContain("Seneste rapporter");
    expect(markup).not.toContain("AnbudAppliance/Urban_Reuse_Norway");
    expect(markup).not.toContain("/home/anbudklient");
    expect(markup).toContain("Åpne rapport");
    expect(markup).toContain("Åpne kommentardokument");
    expect(markup).toContain("Åpne prosjekt");
    expect(markup).toContain('href="/api/projects/Bryn%20Skole/reports/latest/open"');
    expect((markup.match(/Åpne kommentardokument/g) ?? []).length).toBe(1);
  });
});
