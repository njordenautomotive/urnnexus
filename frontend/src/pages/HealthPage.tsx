import { AppHeader } from "../components/Layout";
import { EmptyState } from "../components/EmptyState";
import { StatusPill } from "../components/StatusPill";
import { useAppData } from "../context/AppDataContext";

export function HealthPage() {
  const { health, healthLoading, healthError, projects } = useAppData();

  if (healthError) {
    return <EmptyState title="Kunne ikke hente health" description={healthError} />;
  }

  return (
    <div className="page-stack">
      <AppHeader title="Health" description="Teknisk status for appliance, versjon og oppetid." />

      {healthLoading || !health ? (
        <section className="surface surface--padded">
          <div className="loading-copy">Laster helsestatus …</div>
        </section>
      ) : (
        <section className="surface surface--padded">
          <div className="detail-grid">
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
              <span>Kilde</span>
              <strong>Lokal appliance-cache</strong>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
