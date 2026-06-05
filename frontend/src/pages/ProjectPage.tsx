import { useOutletContext, useParams, Outlet, Link } from "react-router-dom";
import { ErrorState } from "../components/ErrorState";
import { ProjectHeader } from "../components/Layout";
import { Tabs } from "../components/Tabs";
import { formatDateTime, getProject, projectUrl, safeDecodeProjectName } from "../lib/api";
import { useResource } from "../lib/useResource";
import type { ProjectDetailResponse } from "../types";

export interface ProjectPageContext {
  project: ProjectDetailResponse;
  reloadProject: () => void;
}

export function useProjectPageContext(): ProjectPageContext {
  return useOutletContext<ProjectPageContext>();
}

function formatLatestComment(project: ProjectDetailResponse): string {
  if (project.latest_comment_document === null) {
    return "Ingen kommentardokumenter ennå";
  }
  if (project.latest_comment_modified_at === null) {
    return project.latest_comment_document;
  }
  return `${project.latest_comment_document} · ${formatDateTime(project.latest_comment_modified_at)}`;
}

function formatFileCount(project: ProjectDetailResponse): string {
  if (project.file_count === 0 && project.comment_document_count > 0) {
    return "0 filer · kun kommentardokumenter i Kommentarer";
  }
  return `${project.file_count} filer`;
}

export function ProjectPage() {
  const { projectName: routeProjectName = "" } = useParams();
  const projectName = safeDecodeProjectName(routeProjectName);
  const { data: project, loading, error, reload } = useResource(() => getProject(projectName), [projectName]);

  const tabs = projectName
    ? [
        { to: projectUrl(projectName), label: "Oversikt" },
        { to: projectUrl(projectName, "files"), label: "Filer" },
        { to: projectUrl(projectName, "reports"), label: "Rapporter" },
      ]
    : [];

  return (
    <div className="page-stack">
      {error ? (
        <ErrorState
          title="Kunne ikke åpne prosjektet"
          description={error}
          action={
            <Link className="button button--secondary" to="/projects">
              Tilbake til prosjekter
            </Link>
          }
        />
      ) : loading || !project ? (
        <section className="surface surface--padded">
          <div className="loading-copy">Laster prosjekt …</div>
        </section>
      ) : (
        <>
          <ProjectHeader
            title={project.display_name}
            relativeProjectPath={project.relative_project_path}
            sourceLabel={project.source_label}
            status={project.status}
            meta={[
              formatFileCount(project),
              formatLatestComment(project),
              project.last_synced_at ? `Sist synket ${formatDateTime(project.last_synced_at)}` : "Sist synket: ukjent",
            ]}
            actions={
              <button type="button" className="button button--secondary" onClick={reload}>
                Oppdater visning
              </button>
            }
          />
          <Tabs items={tabs} />
          <Outlet context={{ project, reloadProject: reload }} />
        </>
      )}
    </div>
  );
}
