import { describe, expect, it } from "vitest";
import { displayProjectPath, filterVisibleProjects } from "./projects";
import type { ProjectSummary } from "../types";

function makeProject(project_name: string, is_sample_project: boolean): ProjectSummary {
  return {
    project_name,
    display_name: project_name,
    source_label: "OneDrive",
    relative_project_path: is_sample_project ? `sample_projects/${project_name}` : `Urban_Reuse_Norway/${project_name}`,
    hidden_internal_path: is_sample_project ? `/home/anbudklient/appliance/sample_projects/${project_name}` : `/home/anbudklient/appliance/runtime/${project_name}`,
    last_synced_at: "2026-06-04T08:00:00+02:00",
    latest_comment_document: `${project_name} - Kommentardokument.docx`,
    latest_comment_document_open_url: `/api/projects/${encodeURIComponent(project_name)}/reports/latest/open`,
    latest_comment_modified_at: "2026-06-04T08:15:00+02:00",
    comment_document_count: 1,
    is_sample_project,
    project_path: `/home/anbudklient/appliance/${project_name}`,
    last_analyzed_at: "2026-06-04T08:15:00+02:00",
    status: "completed",
    file_count: 12,
    report_count: 1,
    warnings: [],
    errors: [],
  };
}

describe("project visibility helpers", () => {
  it("filters sample projects out of the standard view", () => {
    const visible = filterVisibleProjects([makeProject("Bryn Skole", false), makeProject("Testprosjekt", true)]);

    expect(visible).toHaveLength(1);
    expect(visible[0].project_name).toBe("Bryn Skole");
  });

  it("can keep sample projects in dev mode", () => {
    const visible = filterVisibleProjects([makeProject("Bryn Skole", false), makeProject("Testprosjekt", true)], true);

    expect(visible).toHaveLength(2);
  });

  it("removes the appliance folder prefix from display paths", () => {
    expect(displayProjectPath("AnbudAppliance/Urban_Reuse_Norway/Bryn Skole")).toBe("Urban_Reuse_Norway/Bryn Skole");
    expect(displayProjectPath("sample_projects/Testprosjekt")).toBe("sample_projects/Testprosjekt");
  });
});
