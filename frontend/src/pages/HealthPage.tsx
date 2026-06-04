import { AppHeader } from "../components/Layout";
import { EmptyState } from "../components/EmptyState";
import { StatCard } from "../components/StatCard";
import { StatusPill } from "../components/StatusPill";
import { useAppData } from "../context/AppDataContext";

export function HealthPage() {
  const { health, healthLoading, healthError } = useAppData();

  return (
    <div className="page-stack">
      <AppHeader title="Health" description="Direkte status for appliance, versjon og oppdagede prosjekter." />

      {healthError ? (
        <EmptyState title="Kunne ikke hente health" description={healthError} />
      ) : healthLoading || !health ? (
        <section className="surface surface--padded">Laster helsestatus …</section>
      ) : (
        <>
          <section className="surface surface--padded">
            <div className="stats-grid">
              <StatCard
                label="Tilgjengelig"
                value={health.appliance_available ? "Ja" : "Nei"}
                note={health.appliance_available ? "Appliance svarer på API-kall" : "Appliance er ikke tilgjengelig"}
                tone={health.appliance_available ? "success" : "warning"}
              />
              <StatCard label="Uptime" value={health.uptime} note={`${health.uptime_seconds.toFixed(0)} sekunder`} tone="accent" />
              <StatCard label="Versjon" value={health.version ?? "Ukjent"} note="Fra /api/health" tone="neutral" />
              <StatCard
                label="Oppdagede prosjekter"
                value={health.discovered_projects.toLocaleString("nb-NO")}
                note="Prosjekter appliance kjenner til"
                tone="success"
              />
            </div>
          </section>

          <section className="surface surface--padded">
            <div className="section-header">
              <div>
                <div className="section-kicker">Detaljer</div>
                <h2 className="section-title">Raw health-data</h2>
              </div>
            </div>

            <dl className="definition-grid">
              <div className="definition-item">
                <dt>Status</dt>
                <dd>
                  <StatusPill status={health.appliance_available ? "online" : "offline"} label={health.appliance_available ? "Online" : "Offline"} />
                </dd>
              </div>
              <div className="definition-item definition-item--wide">
                <dt>Appliance root</dt>
                <dd className="code-block code-block--compact">{health.appliance_root}</dd>
              </div>
            </dl>
          </section>
        </>
      )}
    </div>
  );
}
