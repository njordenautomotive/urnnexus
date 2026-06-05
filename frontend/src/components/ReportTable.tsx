import { formatBytes, formatDateTime } from "../lib/api";
import type { ProjectReport } from "../types";
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
            <th>Navn</th>
            <th>Type</th>
            <th>Sist endret</th>
            <th>Størrelse</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => (
            <tr key={report.report_path}>
              <td>
                <div className="report-table__name">{report.report_name}</div>
                <div className="report-table__path">{report.is_latest ? "Siste kommentardokument" : "Tidligere dokument"}</div>
              </td>
              <td>{report.report_type.toUpperCase()}</td>
              <td>{formatDateTime(report.modified_at)}</td>
              <td>{formatBytes(report.size_bytes)}</td>
              <td>
                <StatusPill status={report.is_latest ? "latest" : "archived"} label={report.is_latest ? "Latest" : "Arkiv"} tone={report.is_latest ? "success" : "neutral"} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
