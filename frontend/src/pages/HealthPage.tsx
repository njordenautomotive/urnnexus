import { AppHeader } from "../components/Layout";
import { EmptyState } from "../components/EmptyState";
import { StatusPill } from "../components/StatusPill";
import { formatBytes, formatDateTime } from "../lib/api";
import { useAppData } from "../context/AppDataContext";

export function HealthPage() {
  const { health, healthLoading, healthError, projects } = useAppData();

  if (healthError) {
    return <EmptyState title="Kunne ikke hente health" description={healthError} />;
  }

  return (
    <div className="page-stack">
      <AppHeader title="Health" description="Driftstilstand for cache, integrasjoner, analyser og rapporter." />

      {healthLoading ? (
        <section className="surface surface--padded">
          <div className="loading-copy">Laster helsestatus …</div>
        </section>
      ) : !health ? (
        <EmptyState title="Kunne ikke hente health" description="API-et returnerte ikke helsedata." />
      ) : (
        <section className="surface surface--padded">
          <div className="health-grid">
            <div className="detail-card">
              <span>Tilgjengelig</span>
              <StatusPill status={health.appliance_available ? "online" : "offline"} label={health.appliance_available ? "Ja" : "Nei"} />
            </div>
            <div className="detail-card">
              <span>Uptime</span>
              <strong>{health.uptime}</strong>
            </div>
            <div className="detail-card">
              <span>Versjon</span>
              <strong>{health.version ?? "Ukjent"}</strong>
            </div>
            <div className="detail-card">
              <span>Prosjekter i visning</span>
              <strong>{projects.length.toLocaleString("nb-NO")}</strong>
            </div>
            <div className="detail-card">
              <span>Antall prosjekter</span>
              <strong>{health.project_count.toLocaleString("nb-NO")}</strong>
            </div>
            <div className="detail-card">
              <span>Antall filer</span>
              <strong>{health.file_count.toLocaleString("nb-NO")}</strong>
            </div>
            <div className="detail-card">
              <span>Rapporter</span>
              <strong>{health.report_count.toLocaleString("nb-NO")}</strong>
            </div>
            <div className="detail-card">
              <span>Siste synk</span>
              <strong>{health.last_synced_at ? formatDateTime(health.last_synced_at) : "—"}</strong>
            </div>
            <div className="detail-card">
              <span>Siste analyse</span>
              <strong>{health.last_analyzed_at ? formatDateTime(health.last_analyzed_at) : "—"}</strong>
            </div>
            <div className="detail-card">
              <span>Siste rapport opprettet</span>
              <strong>{health.latest_report_generated_at ? formatDateTime(health.latest_report_generated_at) : "—"}</strong>
            </div>
            <div className="detail-card">
              <span>OneDrive-status</span>
              <StatusPill status={health.one_drive_status} />
              <small>{health.one_drive_detail}</small>
            </div>
            <div className="detail-card">
              <span>Graph-write</span>
              <StatusPill status={health.graph_write_status} />
              <small>{health.graph_write_detail}</small>
            </div>
            <div className="detail-card">
              <span>OpenAI-status</span>
              <StatusPill status={health.openai_status} />
              <small>{health.openai_detail}</small>
            </div>
            <div className="detail-card">
              <span>SMTP-status</span>
              <StatusPill status={health.smtp_status} />
              <small>{health.smtp_detail}</small>
            </div>
            <div className="detail-card">
              <span>Diskbruk</span>
              <strong>
                {health.disk_used_bytes !== null && health.disk_total_bytes !== null
                  ? `${formatBytes(health.disk_used_bytes)} / ${formatBytes(health.disk_total_bytes)}`
                  : "—"}
              </strong>
            </div>
            <div className="detail-card">
              <span>Ledig disk</span>
              <strong>{formatBytes(health.disk_free_bytes)}</strong>
            </div>
            <div className="detail-card">
              <span>Cache-størrelse</span>
              <strong>{formatBytes(health.cache_size_bytes)}</strong>
            </div>
            <div className="detail-card">
              <span>Feil siste 24 timer</span>
              <strong>{health.errors_last_24h.toLocaleString("nb-NO")}</strong>
            </div>
            <div className="detail-card">
              <span>Varsler siste 24 timer</span>
              <strong>{health.warnings_last_24h.toLocaleString("nb-NO")}</strong>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
