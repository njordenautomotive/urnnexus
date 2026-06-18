import type { ReactNode, SVGProps } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAppData } from "../context/AppDataContext";
import { StatusPill } from "./StatusPill";

export function AppLayout() {
  const { dailySync, dismissDailySync } = useAppData();

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <div className="app-main__frame">
          <Outlet />
        </div>
      </main>
      {dailySync ? <DailySyncOverlay title={dailySync.title} message={dailySync.message} detail={dailySync.detail} onContinue={dismissDailySync ?? (() => undefined)} /> : null}
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
          <div className="sidebar-brand-subtitle">Enterprise Review Platform</div>
        </div>
      </div>

      <SidebarSection title="Oversikt">
        <SidebarNavItem to="/" end label="Dashboard" icon={<DashboardIcon />} />
        <SidebarNavItem to="/projects" label="Prosjekter" icon={<ProjectsIcon />} />
      </SidebarSection>

      <SidebarSection title="Arbeid">
        <SidebarNavItem to="/analysis" label="Analyse" icon={<AnalysisIcon />} />
      </SidebarSection>

      <SidebarSection title="Drift">
        <SidebarNavItem to="/health" label="Helse" icon={<HealthIcon />} />
      </SidebarSection>

      {healthError ? <div className="sidebar__error">{healthError}</div> : null}
    </aside>
  );
}

function SidebarSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="sidebar-section" aria-label={title}>
      <div className="sidebar-section-title">{title}</div>
      <nav className="sidebar-nav" aria-label={title}>
        {children}
      </nav>
    </section>
  );
}

function SidebarNavItem({
  to,
  end = false,
  label,
  icon,
}: {
  to: string;
  end?: boolean;
  label: string;
  icon: ReactNode;
}) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `sidebar-nav-item ${isActive ? "sidebar-nav-item-active" : ""}`}>
      <span className="sidebar-nav-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="sidebar-nav-label">{label}</span>
    </NavLink>
  );
}

function DashboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2.5" y="2.5" width="4" height="4" rx="1" />
      <rect x="9.5" y="2.5" width="4" height="4" rx="1" />
      <rect x="2.5" y="9.5" width="4" height="4" rx="1" />
      <rect x="9.5" y="9.5" width="4" height="4" rx="1" />
    </svg>
  );
}

function ProjectsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2.5 5.25A1.25 1.25 0 0 1 3.75 4h3l1.2 1.4H12.25A1.25 1.25 0 0 1 13.5 6.65v4.1A1.25 1.25 0 0 1 12.25 12H3.75A1.25 1.25 0 0 1 2.5 10.75z" />
      <path d="M2.5 6.1h11" />
    </svg>
  );
}

function AnalysisIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2.5 11.5h11" />
      <path d="M4.5 9.5l2.1-2.1 1.8 1.5L12 5.3" />
      <circle cx="4.5" cy="9.5" r=".7" fill="currentColor" stroke="none" />
      <circle cx="6.6" cy="7.4" r=".7" fill="currentColor" stroke="none" />
      <circle cx="8.4" cy="8.9" r=".7" fill="currentColor" stroke="none" />
      <circle cx="12" cy="5.3" r=".7" fill="currentColor" stroke="none" />
    </svg>
  );
}

function HealthIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2.5 8h2.1l1.4-2.8 1.8 5.6 1.5-3h4.2" />
      <path d="M13.5 8.2A5.5 5.5 0 0 1 8 13.5 5.5 5.5 0 0 1 2.5 8a5.5 5.5 0 0 1 11 0Z" />
    </svg>
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

function DailySyncOverlay({
  title,
  message,
  detail,
  onContinue,
}: {
  title: string;
  message: string;
  detail: string | null;
  onContinue: () => void;
}) {
  return (
    <div className="modal-backdrop modal-backdrop--sync" role="presentation">
      <section className="modal-panel modal-panel--sync" role="dialog" aria-modal="true" aria-labelledby="daily-sync-title" aria-describedby="daily-sync-description">
        <div className="sync-loader" aria-hidden="true" />
        <div className="section-kicker">OneDrive</div>
        <h2 className="section-title" id="daily-sync-title">
          {title}
        </h2>
        <p className="modal-copy" id="daily-sync-description">
          {message}
        </p>
        {detail ? <div className="sync-loader__detail">{detail}</div> : null}
        <div className="modal-panel__actions modal-panel__actions--sync">
          <button type="button" className="button button--secondary" onClick={onContinue}>
            Fortsett
          </button>
          <a className="button" href="/health" target="_blank" rel="noreferrer">
            Se status
          </a>
        </div>
      </section>
    </div>
  );
}
