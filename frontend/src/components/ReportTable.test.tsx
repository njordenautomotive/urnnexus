import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReportTable } from "./ReportTable";
import type { ProjectReport } from "../types";

const reports: ProjectReport[] = [
  {
    report_id: "0",
    report_name: "Bryn Skole - Kommentardokument - 1.0.docx",
    report_path: "/tmp/Bryn Skole/Kommentarer/Bryn Skole - Kommentardokument - 1.0.docx",
    report_type: "docx",
    version: null,
    created_at: "2026-06-04T08:15:00+02:00",
    generated_at: "2026-06-04T08:15:00+02:00",
    modified_at: "2026-06-09T09:15:00+02:00",
    size_bytes: 12345,
    is_latest: true,
    open_url: "/api/projects/Bryn%20Skole/reports/0/open",
    download_url: "/api/projects/Bryn%20Skole/reports/0/download",
  },
];

describe("ReportTable", () => {
  it("renders the created time only in the Opprettet column", () => {
    const markup = renderToStaticMarkup(<ReportTable reports={reports} />);

    expect(markup).toContain("Opprettet");
    expect(markup).not.toContain("Sist endret");
    expect(markup).toContain("Bryn Skole - Kommentardokument - 1.0.docx");
    expect(markup).toContain("v1.0");
    expect(markup).toContain("2026");
  });

  it("keeps versioned comment documents readable from the filename and version metadata", () => {
    const markup = renderToStaticMarkup(
      <ReportTable
        reports={[
          { ...reports[0], report_id: "1", report_name: "Bryn Skole - Kommentardokument - 6.0.docx", version: "6.0" },
          {
            ...reports[0],
            report_id: "2",
            report_name: "Bryn Skole - Kommentardokument - 5.0.docx",
            version: "5.0",
            is_latest: false,
          },
        ]}
      />,
    );

    expect(markup).toContain("Bryn Skole - Kommentardokument - 6.0.docx");
    expect(markup).toContain("Bryn Skole - Kommentardokument - 5.0.docx");
    expect(markup).toContain("v6.0");
    expect(markup).toContain("v5.0");
    expect(markup).toContain("Nyeste i Kommentarer");
    expect(markup).toContain("Arkiv");
    expect(markup).not.toContain("Bryn Skole - Kommentardokument - 6.0 - 6.0.docx");
  });

  it("renders open and download as distinct actions", () => {
    const markup = renderToStaticMarkup(<ReportTable reports={reports} />);

    expect(markup).toContain('href="/api/projects/Bryn%20Skole/reports/0/open"');
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('href="/api/projects/Bryn%20Skole/reports/0/download"');
    expect(markup).toContain('download=""');
  });
});
