import { useEffect, useRef, useState } from "react";
import { AppHeader } from "../components/Layout";
import { ErrorState } from "../components/ErrorState";
import { ProjectTable } from "../components/ProjectTable";
import { StatusPill } from "../components/StatusPill";
import { useAppData } from "../context/AppDataContext";
import { ApiRequestError, formatDateTime, getAnalysisStatus, runAnalysis } from "../lib/api";
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
    label: "Legg resultat i daglig digest",
    description: "Samler resultatet i dagens digest for senere utsendelse.",
  },
  {
    mode: "immediate",
    label: "Send e-post når rapportene er ferdige",
    description: "Sender e-post så snart analysen har generert rapportene.",
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
  const analysisPillStatus = analysisStatus?.running ? "RUNNING" : analysisStatus?.status === "failed" ? "failed" : analysisStatus?.last_completed_at ? "completed" : "idle";
  const analysisPillLabel = analysisStatus?.running
    ? "Analyse pågår"
    : analysisStatus?.status === "failed"
      ? "Analyse feilet"
      : analysisStatus?.last_completed_at
        ? "Analyse fullført"
        : "Klar";
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
        setAnalysisMessage(error.message);
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
          description="Kjør full analyse og rapportgenerering for prosjektene som er synlige i portalen."
        />
        <section className="surface surface--padded">
          <div className="loading-copy">Laster prosjekter ...</div>
        </section>
      </div>
    );
  }

  const analysisSummary = [
    {
      label: "Status",
      value: <StatusPill status={analysisPillStatus} label={analysisPillLabel} />,
    },
    {
      label: "Sist startet",
      value: analysisStatus?.last_started_at ? formatDateTime(analysisStatus.last_started_at) : "—",
    },
    {
      label: "Sist fullført",
      value: analysisStatus?.last_completed_at ? formatDateTime(analysisStatus.last_completed_at) : "—",
    },
    {
      label: "Rapporter generert",
      value: analysisStatus ? analysisStatus.reports_generated.toLocaleString("nb-NO") : "—",
    },
  ];

  return (
    <div className="page-stack">
      <AppHeader
        title="Analyse"
        description="Kjør full analyse og rapportgenerering for prosjektene som er synlige i portalen."
      />

      <section className="surface surface--padded">
        <div className="section-head">
          <div>
            <div className="section-kicker">Kjøring</div>
            <h2 className="section-title">Start analyse</h2>
          </div>
          <div className="section-head__actions">
            <button
              type="button"
              className="button"
              onClick={() => setAnalysisTarget(null)}
              disabled={Boolean(analysisDisabledReason) || visibleProjects.length === 0}
              title={analysisDisabledReason ?? "Start analyse for alle prosjekter"}
            >
              Analyser alle prosjekter
            </button>
          </div>
        </div>

        <div className="dashboard-summary">
          {analysisSummary.map((item) => (
            <div className="dashboard-summary__item" key={item.label}>
              <span>{item.label}</span>
              <div className="dashboard-summary__value">{item.value}</div>
            </div>
          ))}
        </div>

        <div className="dashboard-summary__note">
          Velg e-postflyt i dialogen før vi sender jobben til appliance. Analyse kan kun startes herfra.
        </div>

        {analysisDisabledReason ? <div className="inline-note">{analysisDisabledReason}</div> : null}
        {healthError ? <div className="inline-note inline-note--error">{healthError}</div> : null}
        {analysisStatusLoading ? <div className="inline-note">Laster analyse-status ...</div> : null}
        {analysisStatusError ? <div className="inline-note inline-note--error">{analysisStatusError}</div> : null}
        {analysisStatus?.last_error ? <div className="inline-note inline-note--error">Siste analysefeil: {analysisStatus.last_error}</div> : null}
        {analysisMessage ? <div className="inline-note">{analysisMessage}</div> : null}
      </section>

      <section className="surface surface--padded">
        <div className="section-head">
          <div>
            <div className="section-kicker">Prosjekter</div>
            <h2 className="section-title">Velg prosjekt</h2>
          </div>
          <div className="section-head__note">
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
            <div className="section-kicker">Analyse</div>
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
