import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppDataContext } from "../context/AppDataContext";
import type { HealthResponse, ProjectSummary } from "../types";
import { DashboardPage } from "./DashboardPage";

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
  version: "0.1.0",
  appliance_root: "/home/anbudklient/appliance",
  discovered_projects: 2,
};

describe("DashboardPage", () => {
  it("shows short project paths and latest comment open actions only when available", () => {
    const markup = renderToStaticMarkup(
      <AppDataContext.Provider
        value={{
          projects: [
            makeProject({}),
            makeProject({
              project_name: "No Comment",
              display_name: "No Comment",
              relative_project_path: "AnbudAppliance/Urban_Reuse_Norway/No Comment",
              latest_comment_document: null,
              latest_comment_document_open_url: null,
              latest_comment_modified_at: null,
              comment_document_count: 0,
              report_count: 0,
            }),
          ],
          projectsLoading: false,
          projectsError: null,
          projectWarnings: [],
          health,
          healthLoading: false,
          healthError: null,
          refresh: () => undefined,
        }}
      >
        <DashboardPage />
      </AppDataContext.Provider>,
    );

    expect(markup).toContain("Urban_Reuse_Norway/Bryn Skole");
    expect(markup).toContain("Urban_Reuse_Norway/No Comment");
    expect(markup).not.toContain("AnbudAppliance/Urban_Reuse_Norway");
    expect(markup).not.toContain("/home/anbudklient");
    expect(markup).toContain("Åpne kommentardokument");
    expect(markup).toContain('href="/api/projects/Bryn%20Skole/reports/latest/open"');
    expect(markup).toContain("Ingen kommentardokument ennå");
    expect((markup.match(/Åpne kommentardokument/g) ?? []).length).toBe(1);
  });
});
