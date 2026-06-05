import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { describe, expect, it } from "vitest";
import { ProjectTable } from "./ProjectTable";
import type { ProjectSummary } from "../types";

const project: ProjectSummary = {
  project_name: "internal-bryn-skole",
  display_name: "Bryn Skole",
  source_label: "OneDrive",
  relative_project_path: "Urban_Reuse_Norway/Bryn Skole",
  hidden_internal_path: "/home/anbudklient/appliance/.riveanbud_runtime/rive-anbud-appliance/Urban_Reuse_Norway/Bryn Skole",
  last_synced_at: "2026-06-04T08:00:00+02:00",
  latest_comment_document: "Bryn Skole - Kommentardokument.docx",
  latest_comment_document_open_url: "/api/projects/Bryn%20Skole/reports/latest/open",
  latest_comment_modified_at: "2026-06-04T08:15:00+02:00",
  comment_document_count: 1,
  is_sample_project: false,
  project_path: "/home/anbudklient/appliance/.riveanbud_runtime/rive-anbud-appliance/Urban_Reuse_Norway/Bryn Skole",
  last_analyzed_at: "2026-06-04T08:15:00+02:00",
  status: "completed_with_warnings",
  file_count: 42,
  report_count: 1,
  warnings: [],
  errors: [],
};

describe("ProjectTable", () => {
  it("renders display names and relative paths without leaking internal paths", () => {
    const markup = renderToStaticMarkup(
      <StaticRouter location="/projects">
        <ProjectTable projects={[project]} showActions={false} />
      </StaticRouter>,
    );

    expect(markup).toContain("Bryn Skole");
    expect(markup).toContain("Urban_Reuse_Norway/Bryn Skole");
    expect(markup).toContain("Bryn Skole - Kommentardokument.docx");
    expect(markup).not.toContain("internal-bryn-skole");
    expect(markup).not.toContain("/home/anbudklient/appliance/.riveanbud_runtime");
  });
});
