import type { ReactNode } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAppData } from "../context/AppDataContext";
import { projectUrl, safeDecodeProjectName } from "../lib/api";
import { StatusPill } from "./StatusPill";

export function AppLayout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <div className="app-main__frame">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function Sidebar() {
  const { health, healthLoading, healthError, projects, projectsLoading, projectsError, projectWarnings } = useAppData();
  const healthStatus = health?.appliance_available ? "online" : "offline";
  const sortedProjects = [...projects].sort((left, right) => {
    const leftTime = left.last_analyzed_at ? Date.parse(left.last_analyzed_at) : 0;
    const rightTime = right.last_analyzed_at ? Date.parse(right.last_analyzed_at) : 0;
    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }
    return left.project_name.localeCompare(right.project_name, "nb");
  });

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__mark">URN</div>
        <div>
          <div className="sidebar__title">URN Nexus Web</div>
          <div className="sidebar__subtitle">Appliance dashboard</div>
        </div>
      </div>

      <nav className="sidebar__nav" aria-label="Hovednavigasjon">
        <NavLink to="/" end className={({ isActive }) => `sidebar__nav-link ${isActive ? "sidebar__nav-link--active" : ""}`}>
          Dashboard
        </NavLink>
        <NavLink to="/projects" className={({ isActive }) => `sidebar__nav-link ${isActive ? "sidebar__nav-link--active" : ""}`}>
          Prosjekter
        </NavLink>
        <NavLink to="/health" className={({ isActive }) => `sidebar__nav-link ${isActive ? "sidebar__nav-link--active" : ""}`}>
          Health
        </NavLink>
      </nav>

      <section className="sidebar__panel">
        <div className="sidebar__panel-header">
          <div>
            <div className="sidebar__panel-kicker">Status</div>
            <div className="sidebar__panel-title">Appliance</div>
          </div>
          {health ? <StatusPill status={healthStatus} label={healthStatus === "online" ? "Online" : "Offline"} /> : null}
        </div>
        {healthLoading ? (
          <div className="sidebar__muted">Laster helsestatus …</div>
        ) : healthError ? (
          <div className="sidebar__error">{healthError}</div>
        ) : health ? (
          <div className="sidebar__meta">
            <div>
              <span>Versjon</span>
              <strong>{health.version ?? "Ukjent"}</strong>
            </div>
            <div>
              <span>Uptime</span>
              <strong>{health.uptime}</strong>
            </div>
            <div>
              <span>Prosjekter</span>
              <strong>{health.discovered_projects}</strong>
            </div>
          </div>
        ) : null}
      </section>

      <section className="sidebar__projects">
        <div className="sidebar__section-header">
          <div>
            <div className="sidebar__panel-kicker">Prosjekter</div>
            <div className="sidebar__panel-title">Rask tilgang</div>
          </div>
          <Link to="/projects" className="sidebar__section-link">
            Alle
          </Link>
        </div>
        {projectsLoading ? (
          <div className="sidebar__muted">Laster prosjekter …</div>
        ) : projectsError ? (
          <div className="sidebar__error">{projectsError}</div>
        ) : sortedProjects.length === 0 ? (
          <div className="sidebar__muted">Ingen prosjekter funnet.</div>
        ) : (
          <div className="sidebar__project-list">
            {sortedProjects.slice(0, 10).map((project) => (
              <Link key={project.project_name} to={projectUrl(project.project_name)} className="sidebar__project-link">
                <div className="sidebar__project-link-title">{project.project_name}</div>
                <div className="sidebar__project-link-meta">
                  <span>{project.file_count} filer</span>
                  <StatusPill status={project.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {projectWarnings.length > 0 ? (
        <section className="sidebar__panel sidebar__panel--warning">
          <div className="sidebar__panel-kicker">Varsler</div>
          <div className="sidebar__warning-list">
            {projectWarnings.slice(0, 3).map((warning) => (
              <div key={warning} className="sidebar__warning-item">
                {warning}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="sidebar__footer">Ekte API-data · ingen mock-data</div>
    </aside>
  );
}

export function AppHeader({ title, description }: { title: string; description?: string }) {
  const { refresh, health } = useAppData();
  return (
    <header className="page-hero">
      <div className="page-hero__text">
        <div className="page-hero__eyebrow">URN Nexus Web</div>
        <h1 className="page-hero__title">{title}</h1>
        {description ? <p className="page-hero__description">{description}</p> : null}
      </div>
      <div className="page-hero__actions">
        {health ? (
          <StatusPill status={health.appliance_available ? "online" : "offline"} label={health.appliance_available ? "Appliance online" : "Appliance offline"} />
        ) : null}
        <button type="button" className="button button--secondary" onClick={refresh}>
          Oppdater data
        </button>
      </div>
    </header>
  );
}

export function ProjectHeader({
  projectName,
  title,
  status,
  meta,
  statusLabel,
  actions,
}: {
  projectName: string;
  title: string;
  status: string;
  meta?: string[];
  statusLabel?: string;
  actions?: ReactNode;
}) {
  return (
    <section className="project-hero">
      <div>
        <div className="project-hero__crumbs">
          <Link to="/">Dashboard</Link>
          <span>/</span>
          <Link to="/projects">Prosjekter</Link>
          <span>/</span>
          <span>{safeDecodeProjectName(projectName)}</span>
        </div>
        <h1 className="project-hero__title">{title}</h1>
        <div className="project-hero__meta">
          <StatusPill status={status} label={statusLabel} />
          {(meta ?? []).map((item) => (
            <span key={item} className="project-hero__meta-item">
              {item}
            </span>
          ))}
        </div>
      </div>
      {actions ? <div className="page-hero__actions">{actions}</div> : null}
    </section>
  );
}
