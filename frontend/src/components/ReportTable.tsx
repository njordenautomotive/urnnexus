import { formatBytes, formatDateTime } from "../lib/api";
import type { ProjectReport } from "../types";
import { CopyLinkButton } from "./CopyLinkButton";
import { StatusPill } from "./StatusPill";

interface ReportTableProps {
  reports: ProjectReport[];
}

function resolveReportVersion(report: ProjectReport): string | null {
  const explicitVersion = report.version?.trim();
  if (explicitVersion) {
    return explicitVersion;
  }

  const reportName = report.report_name.trim();
  const extensionIndex = reportName.lastIndexOf(".");
  const hasExtension = extensionIndex > reportName.lastIndexOf("/");
  const stem = hasExtension ? reportName.slice(0, extensionIndex) : reportName;
  const versionSeparatorIndex = stem.lastIndexOf(" - ");
  if (versionSeparatorIndex === -1) {
    return null;
  }

  const candidate = stem.slice(versionSeparatorIndex + 3).trim();
  return /^\d+(?:\.\d+)*$/.test(candidate) ? candidate : null;
}

export function ReportTable({ reports }: ReportTableProps) {
  if (reports.length === 0) {
    return <div className="empty-inline">Ingen rapporter ligger i Kommentarer-mappen ennå.</div>;
  }

  return (
    <div className="report-table-wrap">
      <table className="report-table">
        <thead>
          <tr>
            <th>Versjon</th>
            <th>Rapportnavn</th>
            <th>Opprettet</th>
            <th>Størrelse</th>
            <th>Handlinger</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => {
            const resolvedVersion = resolveReportVersion(report);
            const reportName = report.report_name.trim();

            return (
              <tr key={report.report_id}>
                <td>
                  <div className="report-table__version">{resolvedVersion ? `v${resolvedVersion}` : "—"}</div>
                  <div className="report-table__path">{report.report_type.toUpperCase()}</div>
                </td>
                <td>
                  <div className="report-table__name">{reportName}</div>
                  <div className="report-table__path">
                    {resolvedVersion ? `v${resolvedVersion} · ` : ""}
                    {report.is_latest ? "Nyeste i Kommentarer" : "Arkiv"}
                  </div>
                  <div className="report-table__badge">
                    <StatusPill
                      status={report.is_latest ? "latest" : "archived"}
                      label={report.is_latest ? "Nyeste" : "Arkiv"}
                      tone={report.is_latest ? "success" : "neutral"}
                    />
                  </div>
                </td>
                <td>{formatDateTime(report.created_at)}</td>
                <td>{formatBytes(report.size_bytes)}</td>
                <td>
                  {report.open_url || report.download_url ? (
                    <div className="table-actions">
                      {report.open_url ? (
                        <a className="button button--subtle" href={report.open_url} target="_blank" rel="noopener noreferrer">
                          Åpne
                        </a>
                      ) : null}
                      {report.download_url ? (
                        <a className="button button--subtle" href={report.download_url} download>
                          Last ned
                        </a>
                      ) : null}
                      {report.open_url ? <CopyLinkButton href={report.open_url} /> : null}
                    </div>
                  ) : (
                    <span className="report-table__path">Kun historikk</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
