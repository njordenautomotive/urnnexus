import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "../components/Layout";
import { ErrorState } from "../components/ErrorState";
import { ProjectTable } from "../components/ProjectTable";
import { useAppData } from "../context/AppDataContext";
import { createProject, deleteProject, deleteProjectLocalCache, projectUrl } from "../lib/api";
import type { ProjectViewModel } from "../lib/projects";

export function ProjectsPage() {
  const navigate = useNavigate();
  const { projects, projectsLoading, projectsError, health, healthLoading, refresh } = useAppData();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [projectToRemove, setProjectToRemove] = useState<ProjectViewModel | null>(null);
  const [removeMessage, setRemoveMessage] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<ProjectViewModel | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const isInitialProjectsLoad = projectsLoading && projects.length === 0;
  const graphWriteReady = health?.graph_write_status === "configured";
  const createDisabledReason = healthLoading
    ? "Kontrollerer Microsoft Graph-write ..."
    : graphWriteReady
      ? null
      : (health?.graph_write_detail ?? "Microsoft Graph-write er ikke konfigurert.");

  async function handleCreateProject() {
    if (!newProjectName.trim() || isCreating) {
      return;
    }
    setIsCreating(true);
    setCreateMessage("Oppretter prosjekt direkte i OneDrive og synker Nexus ...");
    try {
      const response = await createProject({ project_name: newProjectName });
      setCreateMessage(response.warning ?? `${response.project_name} ble opprettet i OneDrive.`);
      setNewProjectName("");
      setIsCreateOpen(false);
      refresh();
      navigate(projectUrl(response.project_name));
    } catch (error) {
      setCreateMessage(error instanceof Error ? error.message : "Kunne ikke opprette prosjektet.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleRemoveFromNexus() {
    if (!projectToRemove || isRemoving) {
      return;
    }
    setIsRemoving(true);
    setRemoveMessage(null);
    try {
      const response = await deleteProjectLocalCache(projectToRemove.projectName);
      setRemoveMessage(response.message);
      setProjectToRemove(null);
      refresh();
    } catch (error) {
      setRemoveMessage(error instanceof Error ? error.message : "Kunne ikke fjerne prosjektet fra Nexus.");
    } finally {
      setIsRemoving(false);
    }
  }

  async function handleDeleteProject() {
    if (!projectToDelete || isDeleting) {
      return;
    }
    setIsDeleting(true);
    setDeleteMessage(null);
    try {
      const response = await deleteProject(projectToDelete.projectName);
      setDeleteMessage(response.message);
      setProjectToDelete(null);
      refresh();
    } catch (error) {
      setDeleteMessage(error instanceof Error ? error.message : "Kunne ikke slette prosjektet i OneDrive.");
    } finally {
      setIsDeleting(false);
    }
  }

  if (projectsError) {
    return <ErrorState title="Kunne ikke laste prosjektlisten" description={projectsError} />;
  }

  return (
    <div className="page-stack">
        <AppHeader
        title="Prosjekter"
        description="Ryddig liste over OneDrive-prosjekter. Standardvisningen skjuler sample-prosjekter og lokale cache-prosjekter."
      />

      <section className="surface surface--padded">
        <div className="section-head">
          <div>
            <div className="section-kicker">Liste</div>
            <h2 className="section-title">{projects.length.toLocaleString("nb-NO")} prosjekter</h2>
          </div>
          <div className="section-head__actions">
            <div className="section-head__note">{projectsLoading ? "Laster …" : "Navn, filer, synk, kommentardokument, status og handlinger."}</div>
            <button
              type="button"
              className="button"
              onClick={() => setIsCreateOpen(true)}
              disabled={Boolean(createDisabledReason)}
              title={createDisabledReason ?? "Opprett prosjekt i OneDrive"}
            >
              Nytt prosjekt
            </button>
          </div>
        </div>
        {createMessage ? <div className="inline-note">{createMessage}</div> : null}
        {removeMessage ? <div className="inline-note">{removeMessage}</div> : null}
        {deleteMessage ? <div className="inline-note">{deleteMessage}</div> : null}
        {createDisabledReason ? <div className="inline-note">{createDisabledReason}</div> : null}
        {isInitialProjectsLoad ? (
          <div className="loading-copy">Laster prosjekter …</div>
        ) : (
          <ProjectTable
            projects={projects}
            emptyLabel="Ingen prosjekter å vise."
            onRemoveFromNexus={setProjectToRemove}
            onDeleteProject={setProjectToDelete}
          />
        )}
      </section>

      {isCreateOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="create-project-title">
            <div className="section-head">
              <div>
                <div className="section-kicker">Prosjekt</div>
                <h2 className="section-title" id="create-project-title">
                  Nytt prosjekt
                </h2>
              </div>
              <button type="button" className="button button--secondary" onClick={() => setIsCreateOpen(false)}>
                Lukk
              </button>
            </div>
            <label className="field">
              <span>Prosjektnavn</span>
              <input value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} autoFocus placeholder="Bryn Skole" />
            </label>
            <div className="modal-panel__actions">
              <button type="button" className="button button--secondary" onClick={() => setIsCreateOpen(false)}>
                Avbryt
              </button>
              <button type="button" className="button" onClick={() => void handleCreateProject()} disabled={isCreating || !newProjectName.trim()}>
                Opprett prosjekt
              </button>
            </div>
            <div className="inline-note">Prosjektet opprettes direkte i OneDrive og blir synlig etter Graph-respons og Nexus-sync.</div>
          </section>
        </div>
      ) : null}

      {projectToRemove ? (
        <RemoveProjectConfirmationDialog
          project={projectToRemove}
          isRemoving={isRemoving}
          onCancel={() => setProjectToRemove(null)}
          onConfirm={() => void handleRemoveFromNexus()}
        />
      ) : null}

      {projectToDelete ? (
        <DeleteProjectConfirmationDialog
          project={projectToDelete}
          isDeleting={isDeleting}
          onCancel={() => setProjectToDelete(null)}
          onConfirm={() => void handleDeleteProject()}
        />
      ) : null}
    </div>
  );
}

export function RemoveProjectConfirmationDialog({
  project,
  isRemoving,
  onCancel,
  onConfirm,
}: {
  project: ProjectViewModel;
  isRemoving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="remove-project-title">
        <div className="section-head">
          <div>
            <div className="section-kicker">Prosjekt</div>
            <h2 className="section-title" id="remove-project-title">
              Fjern fra Nexus
            </h2>
          </div>
          <button type="button" className="button button--secondary" onClick={onCancel} disabled={isRemoving}>
            Lukk
          </button>
        </div>
        <p className="modal-copy">Dette fjerner prosjektet fra Nexus-visningen og lokal cache. Det sletter ikke prosjektet i OneDrive.</p>
        <div className="project-table__name">{project.displayName}</div>
        <div className="modal-panel__actions">
          <button type="button" className="button button--secondary" onClick={onCancel} disabled={isRemoving}>
            Avbryt
          </button>
          <button type="button" className="button" onClick={onConfirm} disabled={isRemoving}>
            Fjern fra Nexus
          </button>
        </div>
      </section>
    </div>
  );
}

export function DeleteProjectConfirmationDialog({
  project,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  project: ProjectViewModel;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="delete-project-title">
        <div className="section-head">
          <div>
            <div className="section-kicker">Prosjekt</div>
            <h2 className="section-title" id="delete-project-title">
              Slett prosjekt
            </h2>
          </div>
          <button type="button" className="button button--secondary" onClick={onCancel} disabled={isDeleting}>
            Lukk
          </button>
        </div>
        <p className="modal-copy">Dette sletter prosjektet i OneDrive og fjerner det fra Nexus etter synk. Det sletter ikke lokal cache direkte.</p>
        <div className="project-table__name">{project.displayName}</div>
        <div className="modal-panel__actions">
          <button type="button" className="button button--secondary" onClick={onCancel} disabled={isDeleting}>
            Avbryt
          </button>
          <button type="button" className="button" onClick={onConfirm} disabled={isDeleting}>
            Slett prosjekt
          </button>
        </div>
      </section>
    </div>
  );
}
