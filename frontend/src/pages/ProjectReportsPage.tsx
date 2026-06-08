import { ErrorState } from "../components/ErrorState";
import { ReportTable } from "../components/ReportTable";
import { StatusPill } from "../components/StatusPill";
import { formatBytes, formatDateTime, getProjectReports } from "../lib/api";
import { useResource } from "../lib/useResource";
import { useProjectPageContext } from "./ProjectPage";

export function ProjectReportsPage() {
  const { project } = useProjectPageContext();
  const { data: reports, loading, error, reload } = useResource(() => getProjectReports(project.projectName), [project.projectName]);

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
    return (
      <ErrorState
        title="Kunne ikke laste rapportene"
        description="API-et returnerte ikke rapportdata."
        action={
          <button type="button" className="button button--secondary" onClick={reload}>
            Prøv igjen
          </button>
        }
      />
    );
  }

  const totalSize = reports.reports.reduce((sum, report) => sum + report.size_bytes, 0);

  return (
    <div className="section-stack">
      <section className="surface surface--padded">
        <div className="section-head">
          <div>
            <div className="section-kicker">Rapporter</div>
            <h2 className="section-title">Rapporthistorikk</h2>
          </div>
          <div className="section-head__note">
            {project.reportCountLabel} · {formatBytes(totalSize)}
          </div>
        </div>

        <div className="detail-grid detail-grid--compact">
          <div className="detail-card">
            <span>Prosjekt</span>
            <strong>{project.displayName}</strong>
          </div>
          <div className="detail-card">
            <span>Sti</span>
            <strong>{project.breadcrumbPath}</strong>
          </div>
          <div className="detail-card">
            <span>Status</span>
            <StatusPill status={project.status.level} />
          </div>
          <div className="detail-card">
            <span>Siste rapport opprettet</span>
            <strong>{project.latestReport?.createdAt ? formatDateTime(project.latestReport.createdAt) : "—"}</strong>
          </div>
        </div>

        <ReportTable reports={reports.reports} />
      </section>
    </div>
  );
}
