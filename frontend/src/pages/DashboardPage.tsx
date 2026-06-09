import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppHeader } from "../components/Layout";
import { ErrorState } from "../components/ErrorState";
import { EmptyState } from "../components/EmptyState";
import { formatDateTime, getSyncStatus, runSync } from "../lib/api";
import { sortProjectsByActivity, type ProjectViewModel } from "../lib/projects";
import { useAppData } from "../context/AppDataContext";
import { StatusPill } from "../components/StatusPill";
import { CopyLinkButton } from "../components/CopyLinkButton";
import type { HealthResponse, SyncStatusResponse } from "../types";

const SYNC_ONLY_DESCRIPTION = "Henter filer og rapportliste fra OneDrive. Genererer ikke rapport.";

export function resolveDashboardLastSyncedAt(syncStatus: SyncStatusResponse | null, health: HealthResponse | null): string | null {
  return syncStatus?.last_completed_at ?? health?.last_synced_at ?? null;
}

export function DashboardPage() {
  const { projects, projectsLoading, projectsError, health, healthLoading, healthError, refresh } = useAppData();
  const [syncStatus, setSyncStatus] = useState<SyncStatusResponse | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const visibleProjects = sortProjectsByActivity(projects);
  const isInitialProjectsLoad = projectsLoading && visibleProjects.length === 0;
  const applianceStatus = healthLoading ? "loading" : health?.appliance_available ? "online" : "offline";
  const applianceLabel = healthLoading ? "Laster" : health?.appliance_available ? "online" : "offline";
  const metrics = buildDashboardMetrics(visibleProjects);
  const syncPillStatus = syncStatus?.running ? "RUNNING" : syncStatus?.status ?? "idle";
  const syncPillLabel = syncStatus?.running ? "Synk pågår" : syncStatus?.status === "completed" ? "Sist synk fullført" : syncStatus?.status === "failed" ? "Synk feilet" : "Klar";
  const dashboardLastSyncedAt = resolveDashboardLastSyncedAt(syncStatus, health);
  const recentReports = visibleProjects
    .filter((project) => project.latestReport !== null)
    .sort((left, right) => {
      const leftTime = left.latestReport?.createdAt ? Date.parse(left.latestReport.createdAt) : 0;
      const rightTime = right.latestReport?.createdAt ? Date.parse(right.latestReport.createdAt) : 0;
      return rightTime - leftTime;
    })
    .slice(0, 8);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function pollSyncStatus() {
      try {
        const status = await getSyncStatus();
        if (cancelled) {
          return;
        }
        setSyncStatus(status);
        setSyncError(null);
        timer = window.setTimeout(pollSyncStatus, status.running ? 3000 : 15000);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setSyncError(error instanceof Error ? error.message : "Kunne ikke lese sync-status.");
        timer = window.setTimeout(pollSyncStatus, 20000);
      }
    }

    void pollSyncStatus();
    return () => {
      cancelled = true;
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  async function handleRunSync() {
    setSyncMessage("Starter trygg OneDrive-sync uten rapportgenerering ...");
    let syncStarted = false;
    try {
      const response = await runSync();
      syncStarted = true;
      setSyncMessage(response.status === "already_running" ? "OneDrive-sync kjører allerede." : "OneDrive-sync startet uten rapportgenerering.");
      try {
        setSyncStatus(await getSyncStatus());
        setSyncError(null);
      } catch (error) {
        setSyncError(error instanceof Error ? error.message : "Kunne ikke lese sync-status.");
      }
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : "Kunne ikke starte OneDrive-sync.");
    } finally {
      if (syncStarted) {
        refresh();
      }
    }
  }

  if (projectsError) {
    return <ErrorState title="Kunne ikke laste dashboardet" description={projectsError} />;
  }

  return (
    <div className="page-stack">
      <AppHeader
        title="Kontrollsenter"
        description="Oversikt over OneDrive-synk, rapporter, prosjekter og systemstatus."
        eyebrow={null}
      />

      <section className="surface surface--padded">
        <div className="dashboard-topline">
          <div className="dashboard-statusline__item">
            <span className="dashboard-statusline__label">Appliance</span>
            <StatusPill status={applianceStatus} label={applianceLabel} />
          </div>
          <div className="dashboard-statusline__item">
            <span className="dashboard-statusline__label">Sist synk fullført</span>
            <strong>{dashboardLastSyncedAt ? formatDateTime(dashboardLastSyncedAt) : "Ukjent"}</strong>
          </div>
          <div className="dashboard-statusline__item">
            <span className="dashboard-statusline__label">Siste analyse</span>
            <strong>{metrics.lastAnalyzedAt ? formatDateTime(metrics.lastAnalyzedAt) : "Ingen analyse"}</strong>
          </div>
          <div className="dashboard-statusline__item">
            <span className="dashboard-statusline__label">Siste rapport</span>
            <strong>{metrics.latestReportAt ? formatDateTime(metrics.latestReportAt) : "Ingen rapport"}</strong>
          </div>
          <div className="dashboard-statusline__item">
            <span className="dashboard-statusline__label">Sync</span>
            <StatusPill status={syncPillStatus} label={syncPillLabel} />
          </div>
          <div className="dashboard-actions">
            <button
              type="button"
              className="button"
              onClick={() => void handleRunSync()}
              disabled={syncStatus?.running === true}
              title={SYNC_ONLY_DESCRIPTION}
              aria-label={`Synk OneDrive. ${SYNC_ONLY_DESCRIPTION}`}
            >
              Synk OneDrive
            </button>
          </div>
        </div>
        <div className="dashboard-sync-details">
          <span>Siste sync-start: {syncStatus?.last_started_at ? formatDateTime(syncStatus.last_started_at) : "Ikke kjørt fra portal"}</span>
          <span>Siste sync-ferdig: {syncStatus?.last_completed_at ? formatDateTime(syncStatus.last_completed_at) : "—"}</span>
          <span>Endrede filer siste sync: {syncStatus?.files_changed !== undefined ? syncStatus.files_changed.toLocaleString("nb-NO") : "0"}</span>
          <span>Rapporter funnet: {syncStatus?.reports_found !== undefined ? syncStatus.reports_found.toLocaleString("nb-NO") : "0"}</span>
        </div>
        <div className="dashboard-statusline__note">{SYNC_ONLY_DESCRIPTION}</div>
        {healthError ? <div className="inline-note inline-note--error">{healthError}</div> : null}
        {syncError ? <div className="inline-note inline-note--error">{syncError}</div> : null}
        {syncStatus?.last_error ? <div className="inline-note inline-note--error">Siste sync-feil: {syncStatus.last_error}</div> : null}
        {syncMessage ? <div className="inline-note">{syncMessage}</div> : null}
      </section>

      <section className="dashboard-metrics" aria-label="Dashboardnøkkeltall">
        <MetricCard label="Prosjekter totalt" value={metrics.totalProjects.toLocaleString("nb-NO")} />
        <MetricCard label="Med varsler" value={metrics.projectsWithWarnings.toLocaleString("nb-NO")} tone={metrics.projectsWithWarnings > 0 ? "warning" : "neutral"} />
        <MetricCard label="Uten rapport" value={metrics.projectsWithoutReport.toLocaleString("nb-NO")} tone={metrics.projectsWithoutReport > 0 ? "warning" : "neutral"} />
        <MetricCard label="Analysert siste 24t" value={metrics.analyzedLast24Hours.toLocaleString("nb-NO")} />
        <MetricCard label="Totalt antall filer" value={metrics.totalFiles.toLocaleString("nb-NO")} />
        <MetricCard label="Rapporter" value={metrics.totalReports.toLocaleString("nb-NO")} />
      </section>

      <section className="surface surface--padded">
        <div className="section-head">
          <div>
            <div className="section-kicker">Rapporter</div>
            <h2 className="section-title">Seneste rapporter</h2>
          </div>
          <div className="section-head__note">{projectsLoading ? "Laster …" : `${recentReports.length.toLocaleString("nb-NO")} nyeste`}</div>
        </div>

        {isInitialProjectsLoad ? (
          <div className="loading-copy">Laster prosjekter …</div>
        ) : recentReports.length > 0 ? (
          <div className="report-feed">
            {recentReports.map((project) => (
              <article className="report-feed__item" key={project.projectName}>
                <div className="report-feed__main">
                  <div className="report-feed__title">{project.latestReport?.name}</div>
                  <div className="report-feed__meta">
                    <span>{project.displayName}</span>
                    <span>{project.latestReport?.createdAt ? formatDateTime(project.latestReport.createdAt) : "Tidspunkt ukjent"}</span>
                    <StatusPill status={project.status.level} />
                  </div>
                </div>
                <div className="report-feed__actions">
                  {project.latestReport?.openUrl ? (
                    <>
                      <a className="button" href={project.latestReport.openUrl} target="_blank" rel="noreferrer">
                        Åpne rapport
                      </a>
                      <a className="button button--subtle" href={project.latestReport.openUrl} target="_blank" rel="noreferrer">
                        Åpne kommentardokument
                      </a>
                      <CopyLinkButton href={project.latestReport.openUrl} />
                    </>
                  ) : null}
                  <Link className="button button--secondary" to={project.projectHref}>
                    Åpne prosjekt
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="Ingen rapporter" description="Dashboardet har ingen rapporter å vise akkurat nå." />
        )}
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "warning";
}) {
  return (
    <div className={`metric-card metric-card--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function buildDashboardMetrics(projects: ProjectViewModel[]) {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const newest = (values: Array<string | null>) =>
    values.reduce<string | null>((latest, value) => {
      if (!value) {
        return latest;
      }
      if (!latest || Date.parse(value) > Date.parse(latest)) {
        return value;
      }
      return latest;
    }, null);

  return {
    totalProjects: projects.length,
    projectsWithWarnings: projects.filter((project) => project.hasWarnings || project.hasErrors).length,
    projectsWithoutReport: projects.filter((project) => project.reportCount === 0).length,
    analyzedLast24Hours: projects.filter((project) => project.lastAnalyzedAt && now - Date.parse(project.lastAnalyzedAt) <= oneDay).length,
    totalFiles: projects.reduce((sum, project) => sum + project.fileCount, 0),
    totalReports: projects.reduce((sum, project) => sum + project.reportCount, 0),
    lastAnalyzedAt: newest(projects.map((project) => project.lastAnalyzedAt)),
    latestReportAt: newest(projects.map((project) => project.latestReport?.createdAt ?? null)),
  };
}
