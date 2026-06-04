import { Link } from "react-router-dom";
import { formatDateTime, projectUrl } from "../lib/api";
import type { ProjectSummary } from "../types";
import { StatusPill } from "./StatusPill";

interface ProjectCardProps {
  project: ProjectSummary;
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link className="project-card" to={projectUrl(project.project_name)}>
      <div className="project-card__header">
        <div>
          <div className="project-card__title">{project.project_name}</div>
          <div className="project-card__path">{project.project_path}</div>
        </div>
        <StatusPill status={project.status} />
      </div>
      <div className="project-card__meta">
        <span>{project.file_count} filer</span>
        <span>{project.report_count} rapporter</span>
        <span>{project.last_analyzed_at ? `Analysert ${formatDateTime(project.last_analyzed_at)}` : "Ikke analysert"}</span>
      </div>
      <div className="project-card__footer">Åpne prosjekt</div>
    </Link>
  );
}

