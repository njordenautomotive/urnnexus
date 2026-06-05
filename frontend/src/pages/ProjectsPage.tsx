import { AppHeader } from "../components/Layout";
import { ErrorState } from "../components/ErrorState";
import { ProjectTable } from "../components/ProjectTable";
import { useAppData } from "../context/AppDataContext";

export function ProjectsPage() {
  const { projects, projectsLoading, projectsError } = useAppData();
  const isInitialProjectsLoad = projectsLoading && projects.length === 0;

  if (projectsError) {
    return <ErrorState title="Kunne ikke laste prosjektlisten" description={projectsError} />;
  }

  return (
    <div className="page-stack">
      <AppHeader
        title="Prosjekter"
        description="Ryddig liste over OneDrive-prosjekter. Standardvisningen skjuler sample-prosjekter og viser bare reelle prosjekter."
      />

      <section className="surface surface--padded">
        <div className="section-head">
          <div>
            <div className="section-kicker">Liste</div>
            <h2 className="section-title">{projects.length.toLocaleString("nb-NO")} prosjekter</h2>
          </div>
          <div className="section-head__note">{projectsLoading ? "Laster …" : "Navn, filer, synk, kommentardokument, status og handlinger."}</div>
        </div>
        {isInitialProjectsLoad ? <div className="loading-copy">Laster prosjekter …</div> : <ProjectTable projects={projects} emptyLabel="Ingen prosjekter å vise." />}
      </section>
    </div>
  );
}
