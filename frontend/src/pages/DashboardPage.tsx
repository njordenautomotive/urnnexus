import { AppHeader } from "../components/Layout";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import { ProjectTable } from "../components/ProjectTable";
import { formatDateTime } from "../lib/api";
import { sortProjectsByActivity } from "../lib/projects";
import { useAppData } from "../context/AppDataContext";
import { StatusPill } from "../components/StatusPill";

export function DashboardPage() {
  const { projects, projectsLoading, projectsError, health, healthLoading, healthError } = useAppData();
  const visibleProjects = sortProjectsByActivity(projects);
  const isInitialProjectsLoad = projectsLoading && visibleProjects.length === 0;
  const latestProject = visibleProjects[0] ?? null;
  const latestActivityLabel = latestProject?.last_synced_at
    ? formatDateTime(latestProject.last_synced_at)
    : latestProject?.latest_comment_modified_at
      ? formatDateTime(latestProject.latest_comment_modified_at)
      : "Ukjent";
  const applianceStatus = healthLoading ? "loading" : health?.appliance_available ? "online" : "offline";
  const applianceLabel = healthLoading ? "Laster" : health?.appliance_available ? "online" : "offline";

  if (projectsError) {
    return <ErrorState title="Kunne ikke laste dashboardet" description={projectsError} />;
  }

  return (
    <div className="page-stack">
      <AppHeader
        title="URN Nexus"
        description="OneDrive-portal for Urban Reuse Norway."
      />

      <section className="surface surface--padded">
        <div className="dashboard-statusline">
          <div className="dashboard-statusline__item">
            <span className="dashboard-statusline__label">Appliance</span>
            <StatusPill status={applianceStatus} label={applianceLabel} />
          </div>
          <div className="dashboard-statusline__item">
            <span className="dashboard-statusline__label">Prosjekter</span>
            <strong>{projects.length.toLocaleString("nb-NO")} OneDrive-prosjekter</strong>
          </div>
          <div className="dashboard-statusline__item dashboard-statusline__item--wide">
            <span className="dashboard-statusline__label">Sist synket/endret</span>
            <strong>{latestProject ? `${latestProject.display_name} · ${latestActivityLabel}` : "Ingen prosjekter å vise"}</strong>
          </div>
        </div>
        <div className="dashboard-statusline__note">Data leses fra lokal appliance-cache. Oppdater visning synker ikke OneDrive.</div>
        {healthError ? <div className="inline-note inline-note--error">{healthError}</div> : null}
      </section>

      <section className="surface surface--padded">
        <div className="section-head">
          <div>
            <div className="section-kicker">Prosjekter</div>
            <h2 className="section-title">Siste kommentardokumenter</h2>
          </div>
          <div className="section-head__note">{projectsLoading ? "Laster …" : `${visibleProjects.length.toLocaleString("nb-NO")} prosjekter`}</div>
        </div>

        {isInitialProjectsLoad ? (
          <div className="loading-copy">Laster prosjekter …</div>
        ) : visibleProjects.length > 0 ? (
          <ProjectTable projects={visibleProjects} compact showActions={false} emptyLabel="Ingen prosjekter å vise." />
        ) : (
          <EmptyState title="Ingen prosjekter" description="Dashboardet har ingen OneDrive-prosjekter å vise akkurat nå." />
        )}
      </section>
    </div>
  );
}
