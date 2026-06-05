import { Link } from "react-router-dom";
import { formatDateTime, projectUrl } from "../lib/api";
import { displayProjectPath, projectActivityTimestamp, sortProjectsByActivity } from "../lib/projects";
import type { ProjectSummary } from "../types";
import { StatusPill } from "./StatusPill";

interface ProjectTableProps {
  projects: ProjectSummary[];
  compact?: boolean;
  showActions?: boolean;
  showLatestCommentAction?: boolean;
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

export function ProjectTable({
  projects,
  compact = false,
  showActions = true,
  showLatestCommentAction = false,
  emptyLabel = "Ingen prosjekter å vise.",
}: ProjectTableProps) {
  const sortedProjects = sortProjectsByActivity(projects);
  const hasActionColumn = showActions || showLatestCommentAction;

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
            {hasActionColumn ? <th>Handlinger</th> : null}
          </tr>
        </thead>
        <tbody>
          {sortedProjects.map((project) => (
            <ProjectTableRow
              key={project.project_name}
              project={project}
              showActions={showActions}
              showLatestCommentAction={showLatestCommentAction}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProjectTableRow({
  project,
  showActions,
  showLatestCommentAction,
}: {
  project: ProjectSummary;
  showActions: boolean;
  showLatestCommentAction: boolean;
}) {
  const fileCount = formatFileCount(project);
  const latestCommentOpenUrl = project.latest_comment_document ? project.latest_comment_document_open_url : null;
  const hasActionColumn = showActions || showLatestCommentAction;

  return (
    <tr className={project.is_sample_project ? "project-table__row--sample" : ""}>
      <td>
        <div className="project-table__name">{project.display_name}</div>
        <div className="project-table__subline">{displayProjectPath(project.relative_project_path)}</div>
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
      {hasActionColumn ? (
        <td>
          <div className="project-table__actions">
            {showLatestCommentAction && latestCommentOpenUrl ? (
              <a className="button button--subtle" href={latestCommentOpenUrl} target="_blank" rel="noreferrer">
                Åpne kommentardokument
              </a>
            ) : null}
            {showActions ? (
              <>
                <Link className="button button--subtle" to={projectUrl(project.project_name)}>
                  Åpne
                </Link>
                <Link className="button button--subtle" to={projectUrl(project.project_name, "files")}>
                  Filer
                </Link>
                <Link className="button button--subtle" to={projectUrl(project.project_name, "reports")}>
                  Rapporter
                </Link>
              </>
            ) : null}
          </div>
        </td>
      ) : null}
    </tr>
  );
}
