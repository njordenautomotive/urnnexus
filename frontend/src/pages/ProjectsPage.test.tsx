import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { describe, expect, it } from "vitest";
import { AppDataContext } from "../context/AppDataContext";
import { createProjectViewModel } from "../lib/projects";
import type { HealthResponse, ProjectSummary } from "../types";
import { DeleteProjectConfirmationDialog, ProjectsPage } from "./ProjectsPage";

function makeProject(projectName: string): ProjectSummary {
  return {
    project_name: projectName,
    display_name: projectName,
    source_label: "OneDrive",
    relative_project_path: `Urban_Reuse_Norway/${projectName}`,
    hidden_internal_path: `/home/anbudklient/appliance/runtime/${projectName}`,
    last_synced_at: "2026-06-04T08:00:00+02:00",
    latest_comment_document: null,
    latest_comment_document_open_url: null,
    latest_comment_created_at: null,
    latest_comment_modified_at: null,
    comment_document_count: 0,
    is_sample_project: false,
    is_local_cache_only: false,
    project_path: `/home/anbudklient/appliance/${projectName}`,
    last_analyzed_at: null,
    status: "pending",
    file_count: 0,
    report_count: 0,
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
  last_analyzed_at: null,
  latest_report_generated_at: null,
  project_count: 1,
  file_count: 0,
  report_count: 0,
  one_drive_status: "available",
  one_drive_detail: "1 prosjekt funnet i lokal OneDrive-cache.",
  graph_write_status: "not_configured",
  graph_write_detail: "Microsoft Graph-write mangler konfigurasjon: MICROSOFT_CLIENT_SECRET",
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

describe("ProjectsPage", () => {
  it("disables new project when Graph-write is missing", () => {
    const markup = renderToStaticMarkup(
      <StaticRouter location="/projects">
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
          <ProjectsPage />
        </AppDataContext.Provider>
      </StaticRouter>,
    );

    expect(markup).toContain("Nytt prosjekt");
    expect(markup).not.toContain("URN Nexus");
    expect(markup).not.toContain("page-header__eyebrow");
    expect(markup).toContain("Microsoft Graph-write mangler konfigurasjon");
    expect(markup).toContain("disabled");
  });

  it("renders delete confirmation copy before OneDrive deletion", () => {
    const project = createProjectViewModel(makeProject("Bryn Skole"));
    const markup = renderToStaticMarkup(
      <StaticRouter location="/projects">
        <DeleteProjectConfirmationDialog project={project} isDeleting={false} onCancel={() => undefined} onConfirm={() => undefined} />
      </StaticRouter>,
    );

    expect(markup).toContain("Slett prosjekt");
    expect(markup).toContain("Dette sletter prosjektet i OneDrive og fjerner det fra Nexus etter synk.");
    expect(markup).toContain("Bryn Skole");
    expect(markup).not.toContain("Fjern fra Nexus");
  });
});
