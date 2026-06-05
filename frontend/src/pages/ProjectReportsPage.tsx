import { ErrorState } from "../components/ErrorState";
import { ReportTable } from "../components/ReportTable";
import { formatBytes, formatDateTime, getProjectReports } from "../lib/api";
import { useResource } from "../lib/useResource";
import { useProjectPageContext } from "./ProjectPage";

export function ProjectReportsPage() {
  const { project } = useProjectPageContext();
  const { data: reports, loading, error, reload } = useResource(() => getProjectReports(project.project_name), [project.project_name]);

  if (loading) {
    return (
      <section className="surface surface--padded">
        <div className="loading-copy">Laster rapporter …</div>
      </section>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Kunne ikke laste rapportene"
        description={error}
        action={
          <button type="button" className="button button--secondary" onClick={reload}>
            Prøv igjen
          </button>
        }
      />
    );
  }

  if (!reports) {
    return null;
  }

  const totalSize = reports.reports.reduce((sum, report) => sum + report.size_bytes, 0);

  return (
    <div className="section-stack">
      <section className="surface surface--padded">
        <div className="section-head">
          <div>
            <div className="section-kicker">Rapporter</div>
            <h2 className="section-title">Kommentarer</h2>
          </div>
          <div className="section-head__note">
            {reports.count.toLocaleString("nb-NO")} dokumenter · {formatBytes(totalSize)}
          </div>
        </div>

        <div className="detail-grid detail-grid--compact">
          <div className="detail-card">
            <span>Prosjekt</span>
            <strong>{reports.display_name}</strong>
          </div>
          <div className="detail-card">
            <span>Relativ sti</span>
            <strong>{reports.relative_project_path}</strong>
          </div>
          <div className="detail-card">
            <span>Siste kommentardokument</span>
            <strong>{reports.latest_comment_document ?? "Ingen"}</strong>
          </div>
          <div className="detail-card">
            <span>Sist endret</span>
            <strong>{reports.latest_comment_modified_at ? formatDateTime(reports.latest_comment_modified_at) : "—"}</strong>
          </div>
        </div>

        <ReportTable reports={reports.reports} />
      </section>
    </div>
  );
}
