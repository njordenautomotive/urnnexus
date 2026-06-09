import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReportTable } from "./ReportTable";
import type { ProjectReport } from "../types";

const reports: ProjectReport[] = [
  {
    report_id: "0",
    report_name: "Bryn Skole - Kommentardokument.docx",
    report_path: "/tmp/Bryn Skole/Kommentarer/Bryn Skole - Kommentardokument.docx",
    report_type: "docx",
    version: "1.0",
    created_at: null,
    generated_at: "2026-06-04T08:15:00+02:00",
    modified_at: "2026-06-09T09:15:00+02:00",
    size_bytes: 12345,
    is_latest: true,
    open_url: "/api/projects/Bryn%20Skole/reports/0/open",
    download_url: "/api/projects/Bryn%20Skole/reports/0/download",
  },
];

describe("ReportTable", () => {
  it("renders created time only in the Opprettet column", () => {
    const markup = renderToStaticMarkup(<ReportTable reports={reports} />);

    expect(markup).toContain("Opprettet");
    expect(markup).toContain("Sist endret");
    expect((markup.match(/—/g) ?? []).length).toBe(1);
    expect(markup).toContain("2026");
  });
});
