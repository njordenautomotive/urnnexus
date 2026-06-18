import { useEffect, useRef, useState, type ReactNode } from "react";
import { AppHeader } from "../components/Layout";
import { ErrorState } from "../components/ErrorState";
import { ProjectTable } from "../components/ProjectTable";
import { StatusPill } from "../components/StatusPill";
import { useAppData } from "../context/AppDataContext";
import { ApiRequestError, formatDateTime, getAnalysisStatus, runAnalysis } from "../lib/api";
import { APPLIANCE_BUSY_MESSAGE, getVisibleAnalysisErrorMessage, isLockBusyError } from "../lib/applianceStatus";
import type { ProjectViewModel } from "../lib/projects";
import type { AnalysisStatusResponse } from "../types";

type AnalysisEmailMode = "daily_digest" | "immediate";

const ANALYSIS_EMAIL_MODES: Array<{
  mode: AnalysisEmailMode;
  label: string;
  description: string;
}> = [
  {
    mode: "daily_digest",
    label: "Legg resultat i daglig digest (kl. 05:50)",
    description: " ",
  },
  {
    mode: "immediate",
    label: "Send e-post når rapportene er ferdige",
    description: " ",
  },
];

export function AnalysisPage() {
  const { projects, projectsLoading, projectsError, health, healthLoading, healthError, refresh } = useAppData();
  const [analysisTarget, setAnalysisTarget] = useState<ProjectViewModel | null | undefined>(undefined);
  const [selectedEmailMode, setSelectedEmailMode] = useState<AnalysisEmailMode>("daily_digest");
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatusResponse | null>(null);
  const [analysisStatusError, setAnalysisStatusError] = useState<string | null>(null);
  const [analysisStatusLoading, setAnalysisStatusLoading] = useState(true);
  const previousRunningRef = useRef(false);

  const graphWriteReady = health?.graph_write_status === "configured";
  const analysisDisabledReason = healthLoading
    ? "Kontrollerer Microsoft Graph-write ..."
    : graphWriteReady
      ? null
      : health?.graph_write_detail ?? "Microsoft Graph-write er ikke konfigurert.";
  const analysisPillStatus = analysisStatusLoading && !analysisStatus ? "loading" : analysisStatus?.running ? "RUNNING" : analysisStatus?.status === "failed" ? "failed" : analysisStatus?.last_completed_at ? "completed" : "idle";
  const analysisPillLabel = analysisStatusLoading && !analysisStatus
    ? "Laster"
    : analysisStatus?.running
      ? "Analyse pågår"
      : analysisStatus?.status === "failed"
        ? "Analyse feilet"
        : analysisStatus?.last_completed_at
          ? "Analyse fullført"
          : "Klar";
  const analysisLastError = getVisibleAnalysisErrorMessage(analysisStatus?.last_error);
  const analysisFailureMessage = analysisStatus?.status === "failed" ? analysisLastError ?? "Siste analyse endte med feil." : analysisLastError;
  const analysisLastErrorTone = analysisStatus?.last_error && isLockBusyError(analysisStatus.last_error) ? "warning" : "danger";
  const analysisMessageTone =
    analysisMessage === APPLIANCE_BUSY_MESSAGE
      ? "warning"
      : analysisMessage?.toLowerCase().includes("kunne ikke") || analysisMessage?.toLowerCase().includes("feil")
        ? "danger"
        : "info";
  const visibleProjects = projects;

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function pollAnalysisStatus() {
      try {
        const status = await getAnalysisStatus();
        if (cancelled) {
          return;
        }
        setAnalysisStatus(status);
        setAnalysisStatusError(null);
        timer = window.setTimeout(pollAnalysisStatus, status.running ? 5000 : 30000);
      } catch (error) {
        if (cancelled) {
          return;
        }
        console.error("[AnalysisPage] getAnalysisStatus failed", error);
        setAnalysisStatusError(error instanceof Error ? error.message : "Kunne ikke lese analyse-status.");
        timer = window.setTimeout(pollAnalysisStatus, 30000);
      } finally {
        if (!cancelled) {
          setAnalysisStatusLoading(false);
        }
      }
    }

    void pollAnalysisStatus();
    return () => {
      cancelled = true;
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  useEffect(() => {
    const wasRunning = previousRunningRef.current;
    const isRunning = Boolean(analysisStatus?.running);
    previousRunningRef.current = isRunning;
    if (wasRunning && !isRunning) {
      refresh();
    }
  }, [analysisStatus, refresh]);

  async function handleStartAnalysis(target: ProjectViewModel | null) {
    if (isSubmitting || analysisDisabledReason) {
      return;
    }
    setIsSubmitting(true);
    setAnalysisMessage(target ? `Starter analyse for ${target.displayName} ...` : "Starter analyse for alle prosjekter ...");
    try {
      const response = await runAnalysis({
        project_name: target?.projectName ?? null,
        email_mode: selectedEmailMode,
      });
      setAnalysisStatus((current) => ({
        process_alive: true,
        lock_exists: true,
        lock_stale: false,
        activity: "analysis",
        running: response.running,
        job_id: response.job_id,
        last_started_at: response.started_at,
        last_completed_at: current?.last_completed_at ?? null,
        last_error: null,
        projects_synced: response.projects_synced,
        files_changed: response.files_changed,
        reports_found: response.reports_found,
        reports_generated: response.reports_generated,
        email_mode: response.email_mode,
        project_name: response.project_name,
        status: response.status,
        analysis_started: response.analysis_started,
      }));
      setAnalysisMessage(
        target ? `Analyse startet for ${target.displayName}.` : "Analyse startet for alle prosjekter.",
      );
      setAnalysisTarget(undefined);
      refresh();
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 503) {
        setAnalysisMessage(error.message === APPLIANCE_BUSY_MESSAGE ? APPLIANCE_BUSY_MESSAGE : error.message);
      } else {
        setAnalysisMessage(error instanceof Error ? error.message : "Kunne ikke starte analyse.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (projectsError) {
    return <ErrorState title="Kunne ikke laste analysevisningen" description={projectsError} />;
  }

  if (projectsLoading && visibleProjects.length === 0) {
    return (
      <div className="page-stack">
        <AppHeader
          title="Analyse"
          description=""
        />
        <section className="dashboard-card dashboard-card--padded">
          <div className="loading-copy">Laster prosjekter ...</div>
        </section>
      </div>
    );
  }

  const analysisKpis = [
    {
      label: "Status",
      value: <StatusPill status={analysisPillStatus} label={analysisPillLabel} />,
      hint: analysisStatusLoading && !analysisStatus
        ? "Henter status fra appliance."
        : analysisStatus?.running
          ? "Analyse kjører akkurat nå."
          : analysisStatus?.status === "failed"
            ? "Siste kjøring feilet."
            : analysisStatus?.last_completed_at
              ? "Siste kjøring er ferdig."
              : "Ingen registrert kjøring.",
    },
    {
      label: "Sist startet",
      value: analysisStatus?.last_started_at ? formatDateTime(analysisStatus.last_started_at) : "—",
      hint: analysisStatus?.last_started_at ? "Siste registrerte starttidspunkt." : "Ingen starttidspunkt ennå.",
    },
    {
      label: "Sist fullført",
      value: analysisStatus?.last_completed_at ? formatDateTime(analysisStatus.last_completed_at) : "—",
      hint: analysisStatus?.last_completed_at ? "Siste registrerte fullføring." : "Ingen fullføring ennå.",
    },
    {
      label: "Rapporter generert",
      value: analysisStatus ? analysisStatus.reports_generated.toLocaleString("nb-NO") : "—",
      hint: analysisStatus ? "Generert av siste analysekjøring." : "Ingen rapporter registrert ennå.",
    },
  ];

  return (
    <div className="page-stack analysis-page">
      <AppHeader
        title="Analyse"
        description=" "
      />

      <section className="dashboard-card dashboard-card--padded analysis-hero">
        <div className="analysis-hero__header">
          <div>
            <div className="section-kicker">Kjøring</div>
            <h2 className="section-title">Start analyse</h2>
          </div>
          <div className="analysis-hero__actions">
            <button
              type="button"
              className="button button--danger action-button action-button--danger"
              onClick={() => setAnalysisTarget(null)}
              disabled={Boolean(analysisDisabledReason) || visibleProjects.length === 0}
              title={analysisDisabledReason ?? "Start analyse for alle prosjekter"}
            >
              Analyser alle prosjekter
            </button>
          </div>
        </div>

        <div className="analysis-kpi-grid">
          {analysisKpis.map((item) => (
            <AnalysisKpiCard key={item.label} label={item.label} value={item.value} hint={item.hint} />
          ))}
        </div>

        <div className="analysis-hero__body">
          <p className="analysis-hero__note">Velg e-postflyt i dialogen før vi sender jobben til appliance. Analyse kan kun startes herfra.</p>
          <div className="analysis-alert-stack">
            {analysisDisabledReason ? (
              <AnalysisAlert tone="warning" title="Analyse kan ikke startes" message={analysisDisabledReason} />
            ) : null}
            {healthError ? <AnalysisAlert tone="danger" title="Helsedata kunne ikke lastes" message={healthError} /> : null}
            {analysisStatusLoading ? <div className="inline-note inline-note--muted">Laster analyse-status ...</div> : null}
            {analysisStatusError ? (
              <AnalysisAlert
                tone="warning"
                title="Analyse-status er midlertidig utilgjengelig"
                message="Vi fikk ikke lest status akkurat nå. Prøver igjen automatisk."
                detail={analysisStatusError}
              />
            ) : null}
            {analysisFailureMessage ? (
              <AnalysisAlert
                tone={analysisLastErrorTone}
                title={analysisLastErrorTone === "warning" ? "Analyse trenger oppmerksomhet" : "Analyse feilet"}
                message={analysisFailureMessage}
                detail={analysisStatus?.last_error ?? (analysisStatus?.status === "failed" ? "Ingen tekniske detaljer registrert." : null)}
              />
            ) : null}
            {analysisMessage ? (
              <AnalysisAlert
                tone={analysisMessageTone}
                title={analysisMessageTone === "danger" ? "Analyse kunne ikke startes" : analysisMessage === APPLIANCE_BUSY_MESSAGE ? "Analyse er opptatt" : "Analyse startet"}
                message={analysisMessage}
              />
            ) : null}
          </div>
        </div>
      </section>

      <section className="dashboard-card dashboard-card--padded analysis-projects">
        <div className="analysis-projects__head">
          <div>
            <div className="section-kicker">Prosjekter</div>
            <h2 className="section-title">Velg prosjekt</h2>
          </div>
          <div className="analysis-projects__count">
            {visibleProjects.length.toLocaleString("nb-NO")} prosjekter
          </div>
        </div>

        <ProjectTable
          projects={visibleProjects}
          emptyLabel="Ingen prosjekter å analysere."
          onAnalyzeProject={(project) => setAnalysisTarget(project)}
        />
      </section>

      {analysisTarget !== undefined ? (
        <AnalysisRunDialog
          project={analysisTarget}
          selectedEmailMode={selectedEmailMode}
          isSubmitting={isSubmitting}
          onEmailModeChange={setSelectedEmailMode}
          onCancel={() => setAnalysisTarget(undefined)}
          onConfirm={() => void handleStartAnalysis(analysisTarget)}
        />
      ) : null}
    </div>
  );
}

function AnalysisKpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint: string;
}) {
  const isTextValue = typeof value === "string";

  return (
    <div className="kpi-card">
      <div className="kpi-card__label">{label}</div>
      <div className={`kpi-card__value ${isTextValue ? "kpi-card__value--muted" : ""}`}>{value}</div>
      <div className="kpi-card__hint">{hint}</div>
    </div>
  );
}

function AnalysisAlert({
  tone,
  title,
  message,
  detail,
}: {
  tone: "info" | "warning" | "danger";
  title: string;
  message: string;
  detail?: string | null;
}) {
  return (
    <article className={`analysis-alert analysis-alert--${tone}`}>
      <div className="analysis-alert__title">{title}</div>
      <p className="analysis-alert__message">{message}</p>
      {detail ? (
        <details className="analysis-alert__details">
          <summary className="analysis-alert__summary">Vis tekniske detaljer</summary>
          <div className="analysis-alert__details-content">
            <pre className="analysis-alert__code">{detail}</pre>
          </div>
        </details>
      ) : null}
    </article>
  );
}

export function AnalysisRunDialog({
  project,
  selectedEmailMode,
  isSubmitting,
  onEmailModeChange,
  onCancel,
  onConfirm,
}: {
  project: ProjectViewModel | null;
  selectedEmailMode: AnalysisEmailMode;
  isSubmitting: boolean;
  onEmailModeChange: (value: AnalysisEmailMode) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const title = project ? `Analyser ${project.displayName}` : "Analyser alle prosjekter";
  const description = project
    ? "Denne analysen starter appliance-pipelinen for det valgte prosjektet og kan sende e-post når rapportene er ferdige."
    : "Denne analysen starter appliance-pipelinen for alle synlige prosjekter og kan samle resultatet i digest eller sende e-post når rapportene er ferdige.";

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="analysis-dialog-title">
        <div className="section-head">
          <div>
            <div className="section-kicker"> </div>
            <h2 className="section-title" id="analysis-dialog-title">
              {title}
            </h2>
          </div>
          <button type="button" className="button button--secondary" onClick={onCancel} disabled={isSubmitting}>
            Lukk
          </button>
        </div>

        <p className="modal-copy">{description}</p>

        <div className="analysis-mode-list" role="radiogroup" aria-label="E-postflyt">
          {ANALYSIS_EMAIL_MODES.map((option) => (
            <label key={option.mode} className={`analysis-mode-option ${selectedEmailMode === option.mode ? "analysis-mode-option--active" : ""}`}>
              <input
                type="radio"
                name="analysis-email-mode"
                value={option.mode}
                checked={selectedEmailMode === option.mode}
                onChange={() => onEmailModeChange(option.mode)}
                disabled={isSubmitting}
              />
              <span>
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
            </label>
          ))}
        </div>

        <div className="modal-panel__actions">
          <button type="button" className="button button--secondary" onClick={onCancel} disabled={isSubmitting}>
            Avbryt
          </button>
          <button type="button" className="button" onClick={onConfirm} disabled={isSubmitting}>
            Start analyse
          </button>
        </div>
      </section>
    </div>
  );
}
