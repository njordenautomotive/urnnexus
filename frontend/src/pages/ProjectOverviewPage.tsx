import { EmptyState } from "../components/EmptyState";
import { ReportTable } from "../components/ReportTable";
import { StatCard } from "../components/StatCard";
import { StatusPill } from "../components/StatusPill";
import { formatDateTime } from "../lib/api";
import { useProjectPageContext } from "./ProjectPage";

function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }
  return value.toLocaleString("nb-NO");
}

export function ProjectOverviewPage() {
  const { project } = useProjectPageContext();
  const analysis = project.analysis;
  const issues = [...project.warnings, ...project.errors];

  return (
    <div className="section-stack">
      <section className="surface surface--padded">
        <div className="section-header">
          <div>
            <div className="section-kicker">Prosjektoversikt</div>
            <h2 className="section-title">Nøkkeltall</h2>
          </div>
        </div>

        <div className="stats-grid">
          <StatCard label="Filer" value={formatCount(project.file_count)} note="Totalt antall filer i prosjektet" tone="accent" />
          <StatCard label="Rapporter" value={formatCount(project.report_count)} note="Rapporter funnet i Kommentarer-mappen" tone="success" />
          <StatCard label="Status" value={<StatusPill status={project.status} />} note="Backend-status" tone="neutral" />
          <StatCard
            label="Sist analysert"
            value={project.last_analyzed_at ? formatDateTime(project.last_analyzed_at) : "Ikke analysert"}
            note="Basert på appliance-sammenfatningen"
            tone="warning"
          />
        </div>

        <div className="info-grid">
          <div className="info-card">
            <div className="info-card__label">Prosjektsti</div>
            <div className="code-block">{project.project_path}</div>
          </div>
          <div className="info-card">
            <div className="info-card__label">Status</div>
            <StatusPill status={project.status} />
            <div className="info-card__note">
              {project.file_count} filer · {project.report_count} rapporter
            </div>
          </div>
        </div>

        {issues.length > 0 ? (
          <div className="notice-stack">
            {project.warnings.length > 0 ? (
              <div className="notice notice--warning">
                <div className="notice__title">Varsler</div>
                <ul className="notice__list">
                  {project.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {project.errors.length > 0 ? (
              <div className="notice notice--error">
                <div className="notice__title">Feil</div>
                <ul className="notice__list">
                  {project.errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="surface surface--padded">
        <div className="section-header">
          <div>
            <div className="section-kicker">Analyseinfo</div>
            <h2 className="section-title">Detaljer fra siste kjøring</h2>
          </div>
        </div>

        {analysis ? (
          <dl className="definition-grid">
            <div className="definition-item">
              <dt>Status</dt>
              <dd>
                <StatusPill status={analysis.status} />
              </dd>
            </div>
            <div className="definition-item">
              <dt>Sist analysert</dt>
              <dd>{analysis.last_analyzed_at ? formatDateTime(analysis.last_analyzed_at) : "—"}</dd>
            </div>
            <div className="definition-item">
              <dt>Provider</dt>
              <dd>{analysis.provider ?? "—"}</dd>
            </div>
            <div className="definition-item">
              <dt>Modell</dt>
              <dd>{analysis.model ?? "—"}</dd>
            </div>
            <div className="definition-item">
              <dt>Dokumenter sett</dt>
              <dd>{formatCount(analysis.documents_seen)}</dd>
            </div>
            <div className="definition-item">
              <dt>Chunks opprettet</dt>
              <dd>{formatCount(analysis.chunks_created)}</dd>
            </div>
            <div className="definition-item">
              <dt>Rapportpunkter</dt>
              <dd>{formatCount(analysis.report_items_count)}</dd>
            </div>
            <div className="definition-item">
              <dt>Varsler</dt>
              <dd>{formatCount(analysis.warnings_count)}</dd>
            </div>
            <div className="definition-item">
              <dt>Feil</dt>
              <dd>{formatCount(analysis.errors_count)}</dd>
            </div>
            <div className="definition-item definition-item--wide">
              <dt>DOCX-utdata</dt>
              <dd className="code-block code-block--compact">{analysis.output_docx_path ?? "—"}</dd>
            </div>
            <div className="definition-item definition-item--wide">
              <dt>Run summary</dt>
              <dd className="code-block code-block--compact">{analysis.run_summary_path ?? "—"}</dd>
            </div>
          </dl>
        ) : (
          <EmptyState
            title="Ingen analysedata enda"
            description="Denne appliance-installasjonen har bare lest prosjektet. Analyser er ikke startet fra dette grensesnittet ennå."
          />
        )}
      </section>

      <section className="surface surface--padded">
        <div className="section-header">
          <div>
            <div className="section-kicker">Rapporter</div>
            <h2 className="section-title">Siste rapporter</h2>
          </div>
        </div>
        <ReportTable reports={project.reports} />
      </section>
    </div>
  );
}
