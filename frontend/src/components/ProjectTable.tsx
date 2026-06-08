import { Link } from "react-router-dom";
import { formatDateTime } from "../lib/api";
import { sortProjectsByActivity, type ProjectViewModel } from "../lib/projects";
import { StatusPill } from "./StatusPill";

interface ProjectTableProps {
  projects: ProjectViewModel[];
  compact?: boolean;
  emptyLabel?: string;
  onRemoveFromNexus?: (project: ProjectViewModel) => void;
  onDeleteProject?: (project: ProjectViewModel) => void;
}

function formatActivity(project: ProjectViewModel): string {
  return project.activityTimestamp ? formatDateTime(project.activityTimestamp) : "—";
}

export function ProjectTable({
  projects,
  compact = false,
  emptyLabel = "Ingen prosjekter å vise.",
  onRemoveFromNexus,
  onDeleteProject,
}: ProjectTableProps) {
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
            <th>Status</th>
            <th>Rapporter</th>
            <th>Filer</th>
            <th>Siste aktivitet</th>
            <th>Handling</th>
          </tr>
        </thead>
        <tbody>
          {sortedProjects.map((project) => (
            <ProjectTableRow
              key={project.projectName}
              project={project}
              onRemoveFromNexus={onRemoveFromNexus}
              onDeleteProject={onDeleteProject}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProjectTableRow({
  project,
  onRemoveFromNexus,
  onDeleteProject,
}: {
  project: ProjectViewModel;
  onRemoveFromNexus?: (project: ProjectViewModel) => void;
  onDeleteProject?: (project: ProjectViewModel) => void;
}) {
  return (
    <tr className={project.isSampleProject ? "project-table__row--sample" : ""}>
      <td>
        <div className="project-table__name">{project.displayName}</div>
        <div className="project-table__subline">
          {project.isLocalCacheOnly ? "Kun lokal cache - " : ""}
          {project.breadcrumbPath}
        </div>
      </td>
      <td>
        <StatusPill status={project.status.level} />
      </td>
      <td>
        <div className="project-table__name">{project.reportCountLabel}</div>
        <div className="project-table__subline">{project.latestReportLabel}</div>
      </td>
      <td>
        <div className="project-table__name">{project.fileCountLabel}</div>
      </td>
      <td>{formatActivity(project)}</td>
      <td>
        <div className="project-table__actions">
          <Link className="button button--primary" to={project.projectHref}>
            Åpne prosjekt
          </Link>
          {onRemoveFromNexus ? (
            <button type="button" className="button button--secondary" onClick={() => onRemoveFromNexus(project)}>
              Fjern fra Nexus
            </button>
          ) : null}
          {onDeleteProject ? (
            <button type="button" className="button button--secondary" onClick={() => onDeleteProject(project)}>
              Slett prosjekt
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
