import { Link } from "react-router-dom";
import { AppHeader } from "../components/Layout";
import { EmptyState } from "../components/EmptyState";
import { ProjectCard } from "../components/ProjectCard";
import { StatCard } from "../components/StatCard";
import { StatusPill } from "../components/StatusPill";
import { useAppData } from "../context/AppDataContext";
import { formatDateTime } from "../lib/api";
import type { ProjectSummary } from "../types";

function sortProjectsByRecent(projects: ProjectSummary[]): ProjectSummary[] {
  return [...projects].sort((left, right) => {
    const leftTime = left.last_analyzed_at ? Date.parse(left.last_analyzed_at) : 0;
    const rightTime = right.last_analyzed_at ? Date.parse(right.last_analyzed_at) : 0;
    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }
    return left.project_name.localeCompare(right.project_name, "nb");
  });
}

export function DashboardPage() {
  const { projects, projectsLoading, projectsError, projectWarnings, health, healthLoading, healthError } = useAppData();

  const analyzedCount = projects.filter((project) => project.last_analyzed_at !== null).length;
  const totalFiles = projects.reduce((sum, project) => sum + project.file_count, 0);
  const totalReports = projects.reduce((sum, project) => sum + project.report_count, 0);
  const recentProjects = sortProjectsByRecent(projects).slice(0, 6);
  const online = health?.appliance_available ?? false;

  return (
    <div className="page-stack">
      <AppHeader
        title="Dashboard"
        description="Rask oversikt over URN Nexus Web, med ekte status, prosjekter og appliance-data."
      />

      <section className="surface surface--padded">
        <div className="stats-grid">
          <StatCard label="Appliance" value={healthLoading ? "Laster" : online ? "Online" : "Offline"} note={healthError ?? health?.uptime ?? "Ingen helsestatus"} tone={online ? "success" : "warning"} />
          <StatCard label="Prosjekter" value={projects.length.toLocaleString("nb-NO")} note="Oppdaget av appliance" tone="accent" />
          <StatCard label="Analyserte" value={analyzedCount.toLocaleString("nb-NO")} note="Prosjekter med siste analyse" tone="success" />
          <StatCard label="Rapporter" value={totalReports.toLocaleString("nb-NO")} note={`${totalFiles.toLocaleString("nb-NO")} filer totalt`} tone="warning" />
        </div>

        {projectWarnings.length > 0 ? (
          <div className="notice notice--warning">
            <div className="notice__title">Varsler fra prosjektlisten</div>
            <ul className="notice__list">
              {projectWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <div className="dashboard-grid">
        <section className="surface surface--padded">
          <div className="section-header">
            <div>
              <div className="section-kicker">Status</div>
              <h2 className="section-title">Health</h2>
            </div>
          </div>

          {healthError ? (
            <EmptyState title="Health-feil" description={healthError} />
          ) : health ? (
            <div className="health-summary">
              <div className="health-summary__row">
                <span>Status</span>
                <StatusPill status={health.appliance_available ? "online" : "offline"} label={health.appliance_available ? "Online" : "Offline"} />
              </div>
              <div className="health-summary__row">
                <span>Uptime</span>
                <strong>{health.uptime}</strong>
              </div>
              <div className="health-summary__row">
                <span>Versjon</span>
                <strong>{health.version ?? "Ukjent"}</strong>
              </div>
              <div className="health-summary__row">
                <span>Oppdagede prosjekter</span>
                <strong>{health.discovered_projects.toLocaleString("nb-NO")}</strong>
              </div>
              <div className="health-summary__row">
                <span>Appliance root</span>
                <code className="code-inline">{health.appliance_root}</code>
              </div>
            </div>
          ) : null}

          <div className="surface__footer">
            <Link to="/health" className="text-link">
              Åpne full health-visning
            </Link>
          </div>
        </section>

        <section className="surface surface--padded">
          <div className="section-header">
            <div>
              <div className="section-kicker">Prosjekter</div>
              <h2 className="section-title">Nylig aktive</h2>
            </div>
          </div>

          {projectsError ? (
            <EmptyState title="Prosjektfeil" description={projectsError} />
          ) : projectsLoading ? (
            <div className="project-grid project-grid--loading">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="project-card project-card--placeholder">
                  <div className="placeholder placeholder--title" />
                  <div className="placeholder placeholder--line" />
                  <div className="placeholder placeholder--line" />
                </div>
              ))}
            </div>
          ) : recentProjects.length > 0 ? (
            <div className="project-grid">
              {recentProjects.map((project) => (
                <ProjectCard key={project.project_name} project={project} />
              ))}
            </div>
          ) : (
            <EmptyState title="Ingen prosjekter" description="Appliance har ikke rapportert noen prosjekter ennå." />
          )}

          <div className="surface__footer">
            <Link to="/projects" className="text-link">
              Se hele prosjektlisten
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
