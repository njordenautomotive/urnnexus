const flowSteps = [
  "Prosjektmapper ligger i OneDrive.",
  "URN Nexus starter eller følger analysearbeidet.",
  "URN Analysis Engine synker og leser dokumentene lokalt.",
  "Systemet lager en intern pre-kalkyleguide.",
  "Rapporten lastes opp til Kommentarer-mappen i OneDrive.",
  "Daily digest oppsummerer kjøringer, rapporter og status.",
];

const reportIs = [
  "et internt arbeidsgrunnlag for kalkulatører",
  "en dokumentguide gjennom store prosjektmapper",
  "et sammendrag av forhold som bør vurderes tidlig",
  "en hjelp til å finne relevante dokumenter, sider og avklaringer",
];

const reportIsNot = [
  "en offisiell kontraktsvurdering",
  "en ferdig kalkyle",
  "en erstatning for faglig kontroll",
  "klar til bruk i tilbud uten kvalitetssikring",
];

export function AboutPage() {
  return (
    <div className="page-stack about-page">
      <section className="surface surface--padded about-hero">
        <div className="section-kicker">Om systemet</div>
        <h1 className="about-hero__title">Om URN Nexus</h1>
        <p className="about-hero__lead">
          URN Nexus er kontrollsenteret for dokumentanalyse av anbudsgrunnlag. Systemet hjelper kalkulatører med å finne viktig informasjon i store
          prosjektmapper raskere.
        </p>
      </section>

      <section className="about-card-grid" aria-label="Hovedfunksjoner">
        <article className="about-card">
          <span>Kontrollsenter</span>
          <h2>Hva er URN Nexus?</h2>
          <p>
            Nexus er webgrensesnittet der brukeren kan se prosjekter, starte analyser, følge status, åpne rapporter og kontrollere systemhelse.
          </p>
        </article>
        <article className="about-card">
          <span>Analyseagent</span>
          <h2>Hva er URN Analysis Engine?</h2>
          <p>
            URN Analysis Engine er den lokale analyseagenten som synker prosjektmapper fra OneDrive, leser dokumenter, trekker ut nøkkelinformasjon,
            lager interne pre-kalkyleguider og laster rapporter tilbake til OneDrive.
          </p>
        </article>
      </section>

      <section className="surface surface--padded about-flow">
        <div className="section-head">
          <div>
            <div className="section-kicker">Dokumentflyt</div>
            <h2 className="section-title">Hvordan fungerer flyten?</h2>
          </div>
        </div>
        <ol className="about-flow__list">
          {flowSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="about-card-grid about-card-grid--split" aria-label="Rapportforventninger">
        <article className="about-card">
          <span>Pre-kalkyleguide</span>
          <h2>Hva rapporten er</h2>
          <ul>
            {reportIs.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article className="about-card about-card--warning">
          <span>Kvalitetssikring</span>
          <h2>Hva rapporten ikke er</h2>
          <ul>
            {reportIsNot.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  );
}
