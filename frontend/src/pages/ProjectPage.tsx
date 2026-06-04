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

export function ProjectPage() {
  const { projectName: routeProjectName = "" } = useParams();
  const projectName = safeDecodeProjectName(routeProjectName);
  const { data: project, loading, error, reload } = useResource(() => getProject(projectName), [projectName]);

  const title = project?.project_name ?? projectName;
  const status = error ? "failed" : loading ? "loading" : project?.status ?? "unknown";
  const statusLabel = error ? "Feil" : loading ? "Laster" : undefined;
  const meta = project
    ? [
        project.project_path,
        `${project.file_count} filer`,
        `${project.report_count} rapporter`,
        project.last_analyzed_at ? `Sist analysert ${formatDateTime(project.last_analyzed_at)}` : "Ikke analysert",
      ]
    : loading
      ? ["Henter prosjektdata …"]
      : [];

  const tabs = routeProjectName
    ? [
        { to: projectUrl(projectName), label: "Oversikt" },
        { to: projectUrl(projectName, "files"), label: "Filer" },
        { to: projectUrl(projectName, "reports"), label: "Rapporter" },
      ]
    : [];

  return (
    <div className="page-stack">
      <ProjectHeader
        projectName={projectName}
        title={title}
        status={status}
        statusLabel={statusLabel}
        meta={meta}
        actions={
          <button type="button" className="button button--secondary" onClick={reload}>
            Oppdater prosjekt
          </button>
        }
      />

      {error ? (
        <ErrorState
          title="Kunne ikke laste prosjektet"
          description={error}
          action={
            <Link className="button button--secondary" to="/projects">
              Tilbake til prosjekter
            </Link>
          }
        />
      ) : loading ? (
        <section className="surface surface--padded surface--loading">
          <div className="loading-copy">Laster prosjektdata …</div>
        </section>
      ) : project ? (
        <>
          <Tabs items={tabs} />
          <Outlet context={{ project, reloadProject: reload }} />
        </>
      ) : null}
    </div>
  );
}
