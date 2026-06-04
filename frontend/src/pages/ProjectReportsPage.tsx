import { ErrorState } from "../components/ErrorState";
import { ReportTable } from "../components/ReportTable";
import { StatCard } from "../components/StatCard";
import { formatBytes, formatDateTime, getProjectReports } from "../lib/api";
import { useResource } from "../lib/useResource";
import { useProjectPageContext } from "./ProjectPage";

export function ProjectReportsPage() {
  const { project } = useProjectPageContext();
  const { data: reports, loading, error, reload } = useResource(() => getProjectReports(project.project_name), [project.project_name]);

  if (loading) {
    return <section className="surface surface--padded">Laster rapporter …</section>;
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

  const latestReport = reports.reports.find((report) => report.is_latest) ?? reports.reports[0] ?? null;
  const totalBytes = reports.reports.reduce((sum, report) => sum + report.size_bytes, 0);

  return (
    <div className="section-stack">
      <section className="surface surface--padded">
        <div className="section-header">
          <div>
            <div className="section-kicker">Rapporter</div>
            <h2 className="section-title">Dokumenter i Kommentarer</h2>
          </div>
        </div>

        <div className="stats-grid">
          <StatCard label="Antall" value={reports.count.toLocaleString("nb-NO")} note="Rapporter funnet i mappen" tone="accent" />
          <StatCard
            label="Nyeste rapport"
            value={latestReport?.report_name ?? "Ingen rapporter"}
            note={latestReport ? formatDateTime(latestReport.modified_at) : "Det finnes ingen rapporter ennå"}
            tone="success"
          />
          <StatCard label="Total størrelse" value={formatBytes(totalBytes)} note="Sum av alle rapportfiler" tone="warning" />
        </div>

        <ReportTable reports={reports.reports} />
      </section>

      <section className="surface surface--padded">
        <div className="section-header">
          <div>
            <div className="section-kicker">Detaljer</div>
            <h2 className="section-title">Rapportsti</h2>
          </div>
        </div>
        <dl className="definition-grid">
          <div className="definition-item definition-item--wide">
            <dt>Prosjektsti</dt>
            <dd className="code-block code-block--compact">{reports.project_path}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
