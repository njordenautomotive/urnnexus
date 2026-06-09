import type { ReactNode } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAppData } from "../context/AppDataContext";
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
  const { healthError } = useAppData();

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <img className="sidebar__logo" src="/brand/urn_nexus_128.png" alt="" aria-hidden="true" />
        <div className="sidebar__brand-text">
          <div className="sidebar__title">URN Nexus</div>
        </div>
      </div>

      <nav className="sidebar__nav" aria-label="Hovednavigasjon">
        <NavLink to="/" end className={({ isActive }) => `sidebar__nav-link ${isActive ? "sidebar__nav-link--active" : ""}`}>
          Dashboard
        </NavLink>
        <NavLink to="/projects" className={({ isActive }) => `sidebar__nav-link ${isActive ? "sidebar__nav-link--active" : ""}`}>
          Prosjekter
        </NavLink>
        <NavLink to="/analysis" className={({ isActive }) => `sidebar__nav-link ${isActive ? "sidebar__nav-link--active" : ""}`}>
          Analyse
        </NavLink>
        <NavLink to="/health" className={({ isActive }) => `sidebar__nav-link ${isActive ? "sidebar__nav-link--active" : ""}`}>
          Helse
        </NavLink>
      </nav>

      {healthError ? <div className="sidebar__error">{healthError}</div> : null}
    </aside>
  );
}

export function AppHeader({
  title,
  description,
  eyebrow = null,
}: {
  title: string;
  description?: string;
  eyebrow?: string | null;
}) {
  const { refresh } = useAppData();
  return (
    <header className="page-header">
      <div>
        {eyebrow ? <div className="page-header__eyebrow">{eyebrow}</div> : null}
        <h1 className="page-header__title">{title}</h1>
        {description ? <p className="page-header__description">{description}</p> : null}
      </div>
      <div className="page-header__actions">
        <button type="button" className="button button--secondary" onClick={refresh}>
          Oppdater visning
        </button>
      </div>
    </header>
  );
}

export function ProjectHeader({
  title,
  breadcrumbPath,
  sourceLabel,
  status,
  meta,
  statusLabel,
  actions,
}: {
  title: string;
  breadcrumbPath: string;
  sourceLabel: string;
  status: string;
  meta?: string[];
  statusLabel?: string;
  actions?: ReactNode;
}) {
  return (
    <section className="project-header">
      <div>
        <h1 className="project-header__title">{title}</h1>
        <div className="project-header__meta">
          <StatusPill status={status} label={statusLabel} />
          {(meta ?? []).map((item) => (
            <span key={item} className="project-header__meta-item">
              {item}
            </span>
          ))}
        </div>
      </div>
      {actions ? <div className="project-header__actions">{actions}</div> : null}
    </section>
  );
}
