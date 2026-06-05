import { Link } from "react-router-dom";
import { formatDateTime, projectUrl } from "../lib/api";
import { projectActivityTimestamp, sortProjectsByActivity } from "../lib/projects";
import type { ProjectSummary } from "../types";
import { StatusPill } from "./StatusPill";

interface ProjectTableProps {
  projects: ProjectSummary[];
  compact?: boolean;
  showActions?: boolean;
  emptyLabel?: string;
}

function formatActivity(project: ProjectSummary): string {
  const timestamp = projectActivityTimestamp(project);
  return timestamp ? formatDateTime(timestamp) : "—";
}

function formatFileCount(project: ProjectSummary): { value: string; note: string | null } {
  if (project.file_count === 0 && project.comment_document_count > 0) {
    return {
      value: "0",
      note: "Kun kommentardokumenter i Kommentarer",
    };
  }

  return {
    value: project.file_count.toLocaleString("nb-NO"),
    note: null,
  };
}

export function ProjectTable({ projects, compact = false, showActions = true, emptyLabel = "Ingen prosjekter å vise." }: ProjectTableProps) {
  const sortedProjects = sortProjectsByActivity(projects);

  if (sortedProjects.length === 0) {
    return <div className="empty-state empty-state--inline">{emptyLabel}</div>;
  }

  return (
    <div className={`project-table-wrap ${compact ? "project-table-wrap--compact" : ""}`}>
      <table className="project-table">
        <thead>
          <tr>
            <th>Prosjekt</th>
            <th>Filer</th>
            <th>Sist synket/endret</th>
            <th>Siste kommentardokument</th>
            <th>Status</th>
            {showActions ? <th>Handlinger</th> : null}
          </tr>
        </thead>
        <tbody>
          {sortedProjects.map((project) => (
            <ProjectTableRow key={project.project_name} project={project} showActions={showActions} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProjectTableRow({ project, showActions }: { project: ProjectSummary; showActions: boolean }) {
  const fileCount = formatFileCount(project);

  return (
    <tr className={project.is_sample_project ? "project-table__row--sample" : ""}>
      <td>
        <div className="project-table__name">{project.display_name}</div>
        <div className="project-table__subline">{project.relative_project_path}</div>
      </td>
      <td>
        <div className="project-table__name">{fileCount.value}</div>
        {fileCount.note ? <div className="project-table__subline">{fileCount.note}</div> : null}
      </td>
      <td>{formatActivity(project)}</td>
      <td>
        <div className="project-table__name">{project.latest_comment_document ?? "Ingen kommentardokument ennå"}</div>
        <div className="project-table__subline">
          {project.latest_comment_modified_at ? `Endret ${formatDateTime(project.latest_comment_modified_at)}` : "Ikke oppdatert"}
        </div>
      </td>
      <td>
        <StatusPill status={project.status} />
      </td>
      {showActions ? (
        <td>
          <div className="project-table__actions">
            <Link className="button button--subtle" to={projectUrl(project.project_name)}>
              Åpne
            </Link>
            <Link className="button button--subtle" to={projectUrl(project.project_name, "files")}>
              Filer
            </Link>
            <Link className="button button--subtle" to={projectUrl(project.project_name, "reports")}>
              Rapporter
            </Link>
          </div>
        </td>
      ) : null}
    </tr>
  );
}
