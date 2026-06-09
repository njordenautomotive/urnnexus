import { ProjectIssuesPanel } from "../components/ProjectIssuesPanel";
import { StatusPill } from "../components/StatusPill";
import { formatDateTime } from "../lib/api";
import { useProjectPageContext } from "./ProjectPage";

function infoValue(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? value : "—";
}

export function ProjectOverviewPage() {
  const { project, projectDetail } = useProjectPageContext();

  return (
    <div className="section-stack">
      <section className="surface surface--padded">
        <div className="section-head">
          <div>
            <div className="section-kicker">Oversikt</div>
            <h2 className="section-title">Prosjektdetaljer</h2>
          </div>
        </div>

        <div className="detail-grid detail-grid--overview">
          <div className="detail-card">
            <span>Prosjekt</span>
            <strong>{project.displayName}</strong>
          </div>
          <div className="detail-card">
            <span>Kilde</span>
            <strong>{project.sourceLabel}</strong>
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
            <span>Filer</span>
            <strong>{project.fileCountLabel}</strong>
          </div>
          <div className="detail-card">
            <span>Rapporter</span>
            <strong>{project.reportCountLabel}</strong>
          </div>
          <div className="detail-card">
            <span>Sist synket</span>
            <strong>{project.lastSyncedAt ? formatDateTime(project.lastSyncedAt) : "—"}</strong>
          </div>
          <div className="detail-card">
            <span>Siste rapport</span>
            <strong>{infoValue(project.latestReport?.name)}</strong>
          </div>
          <div className="detail-card">
            <span>Siste rapport opprettet</span>
            <strong>{project.latestReport?.createdAt ? formatDateTime(project.latestReport.createdAt) : "—"}</strong>
          </div>
          <div className="detail-card">
            <span>Sist analysert</span>
            <strong>{project.lastAnalyzedAt ? formatDateTime(project.lastAnalyzedAt) : "—"}</strong>
          </div>
          <div className="detail-card">
            <span>Analysegrunnlag</span>
            <strong>
              {projectDetail.analysis?.documents_seen !== null && projectDetail.analysis?.documents_seen !== undefined
                ? `${projectDetail.analysis.documents_seen.toLocaleString("nb-NO")} dokumenter`
                : "—"}
            </strong>
          </div>
        </div>

        {project.hasCommentOnlyFiles ? (
          <div className="inline-note">
            Dette prosjektet har bare kommentardokumenter i Kommentarer. Ingen kildefiler ble funnet i den lokale appliance-cachen.
          </div>
        ) : null}

        <ProjectIssuesPanel project={project} />
      </section>
    </div>
  );
}
