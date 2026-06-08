import { formatBytes, formatDateTime } from "../lib/api";
import type { ProjectReport } from "../types";
import { CopyLinkButton } from "./CopyLinkButton";
import { StatusPill } from "./StatusPill";

interface ReportTableProps {
  reports: ProjectReport[];
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
            <th>Sist endret</th>
            <th>Størrelse</th>
            <th>Handlinger</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => (
            <tr key={report.report_path}>
              <td>
                <div className="report-table__name">{report.version ? `v${report.version}` : "—"}</div>
                <div className="report-table__path">{report.report_type.toUpperCase()}</div>
              </td>
              <td>
                <div className="report-table__name">{report.report_name}</div>
                <div className="report-table__path">{report.is_latest ? "Nyeste i Kommentarer" : "Arkiv"}</div>
                <div className="report-table__badge">
                  <StatusPill
                    status={report.is_latest ? "latest" : "archived"}
                    label={report.is_latest ? "Nyeste" : "Arkiv"}
                    tone={report.is_latest ? "success" : "neutral"}
                  />
                </div>
              </td>
              <td>{formatDateTime(report.created_at ?? report.modified_at)}</td>
              <td>{formatDateTime(report.modified_at)}</td>
              <td>{formatBytes(report.size_bytes)}</td>
              <td>
                <div className="table-actions">
                  <a className="button button--subtle" href={report.open_url} target="_blank" rel="noreferrer">
                    Åpne
                  </a>
                  <a className="button button--subtle" href={report.download_url}>
                    Last ned
                  </a>
                  <CopyLinkButton href={report.open_url} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
