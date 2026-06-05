import { EmptyState } from "../components/EmptyState";
import { StatusPill } from "../components/StatusPill";
import { formatDateTime } from "../lib/api";
import { displayProjectPath } from "../lib/projects";
import { useProjectPageContext } from "./ProjectPage";

function infoValue(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? value : "—";
}

export function ProjectOverviewPage() {
  const { project } = useProjectPageContext();
  const hasCommentOnlyFiles = project.file_count === 0 && project.comment_document_count > 0;

  return (
    <div className="section-stack">
      <section className="surface surface--padded">
        <div className="section-head">
          <div>
            <div className="section-kicker">Oversikt</div>
            <h2 className="section-title">Prosjektdetaljer</h2>
          </div>
        </div>

        <div className="detail-grid">
          <div className="detail-card">
            <span>Prosjekt</span>
            <strong>{project.display_name}</strong>
          </div>
          <div className="detail-card">
            <span>Kilde</span>
            <strong>{project.source_label}</strong>
          </div>
          <div className="detail-card">
            <span>Sti</span>
            <strong>{displayProjectPath(project.relative_project_path)}</strong>
          </div>
          <div className="detail-card">
            <span>Status</span>
            <StatusPill status={project.status} />
          </div>
          <div className="detail-card">
            <span>Filer</span>
            <strong>{project.file_count.toLocaleString("nb-NO")}</strong>
          </div>
          <div className="detail-card">
            <span>Rapporter</span>
            <strong>{project.report_count.toLocaleString("nb-NO")}</strong>
          </div>
          <div className="detail-card">
            <span>Sist synket</span>
            <strong>{project.last_synced_at ? formatDateTime(project.last_synced_at) : "—"}</strong>
          </div>
          <div className="detail-card">
            <span>Siste kommentardokument</span>
            <strong>{infoValue(project.latest_comment_document)}</strong>
          </div>
          <div className="detail-card detail-card--wide">
            <span>Sist kommentardokument endret</span>
            <strong>{project.latest_comment_modified_at ? formatDateTime(project.latest_comment_modified_at) : "—"}</strong>
          </div>
        </div>

        {hasCommentOnlyFiles ? (
          <div className="inline-note">
            Dette prosjektet har bare kommentardokumenter i Kommentarer. Ingen kildefiler ble funnet i den lokale appliance-cachen.
          </div>
        ) : null}

        {project.warnings.length > 0 || project.errors.length > 0 ? (
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
        ) : (
          <EmptyState title="Ingen varsler" description="Dette prosjektet har ingen synlige varsler eller feil akkurat nå." />
        )}
      </section>
    </div>
  );
}
