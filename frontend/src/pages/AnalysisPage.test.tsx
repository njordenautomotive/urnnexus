import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { describe, expect, it } from "vitest";
import { AppDataContext } from "../context/AppDataContext";
import { createProjectViewModel } from "../lib/projects";
import type { HealthResponse, ProjectSummary } from "../types";
import { AnalysisPage, AnalysisRunDialog } from "./AnalysisPage";

function makeProject(projectName: string): ProjectSummary {
  return {
    project_name: projectName,
    display_name: projectName,
    source_label: "OneDrive",
    relative_project_path: `AnbudAppliance/Urban_Reuse_Norway/${projectName}`,
    hidden_internal_path: `/home/anbudklient/appliance/.riveanbud_runtime/rive-anbud-appliance/Urban_Reuse_Norway/${projectName}`,
    last_synced_at: "2026-06-04T08:00:00+02:00",
    latest_comment_document: "Bryn Skole - Kommentardokument.docx",
    latest_comment_document_open_url: "/api/projects/Bryn%20Skole/reports/latest/open",
    latest_comment_created_at: "2026-06-04T08:15:00+02:00",
    latest_comment_modified_at: "2026-06-04T08:15:00+02:00",
    comment_document_count: 1,
    is_sample_project: false,
    project_path: `/home/anbudklient/appliance/.riveanbud_runtime/rive-anbud-appliance/Urban_Reuse_Norway/${projectName}`,
    last_analyzed_at: "2026-06-04T08:15:00+02:00",
    status: "completed_with_warnings",
    file_count: 12,
    report_count: 1,
    warnings: [],
    errors: [],
  };
}

const health: HealthResponse = {
  appliance_available: true,
  uptime_seconds: 120,
  uptime: "0:02:00",
  version: "0.1.5",
  appliance_root: "/home/anbudklient/appliance",
  discovered_projects: 1,
  last_synced_at: "2026-06-04T08:00:00+02:00",
  last_analyzed_at: "2026-06-04T08:15:00+02:00",
  latest_report_generated_at: "2026-06-04T08:15:00+02:00",
  project_count: 1,
  file_count: 12,
  report_count: 1,
  one_drive_status: "available",
  one_drive_detail: "1 prosjekt funnet i lokal OneDrive-cache.",
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

describe("AnalysisPage", () => {
  it("renders analysis controls and per-project analysis buttons without local cache actions", () => {
    const markup = renderToStaticMarkup(
      <StaticRouter location="/analysis">
        <AppDataContext.Provider
          value={{
            projects: [createProjectViewModel(makeProject("Bryn Skole"))],
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
          <AnalysisPage />
        </AppDataContext.Provider>
      </StaticRouter>,
    );

    expect(markup).toContain("Analyse");
    expect(markup).toContain("Analyser alle prosjekter");
    expect(markup).toContain("Analyser");
    expect(markup).not.toContain("Fjern fra Nexus");
    expect(markup).not.toContain("OpenAI-status");
  });

  it("renders the analysis dialog with the expected email mode options", () => {
    const markup = renderToStaticMarkup(
      <StaticRouter location="/analysis">
        <AnalysisRunDialog
          project={createProjectViewModel(makeProject("Bryn Skole"))}
          selectedEmailMode="daily_digest"
          isSubmitting={false}
          onEmailModeChange={() => undefined}
          onCancel={() => undefined}
          onConfirm={() => undefined}
        />
      </StaticRouter>,
    );

    expect(markup).toContain("Analyser Bryn Skole");
    expect(markup).toContain("Legg resultat i daglig digest");
    expect(markup).toContain("Send e-post når rapportene er ferdige");
    expect(markup).toContain("Start analyse");
  });
});
