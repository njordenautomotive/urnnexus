import { Link } from "react-router-dom";
import { formatDateTime } from "../lib/api";
import type { ProjectViewModel } from "../lib/projects";
import { StatusPill } from "./StatusPill";

interface ProjectCardProps {
  project: ProjectViewModel;
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link className="project-card" to={project.projectHref}>
      <div className="project-card__header">
        <div>
          <div className="project-card__title">{project.displayName}</div>
          <div className="project-card__path">{project.breadcrumbPath}</div>
        </div>
        <StatusPill status={project.status.level} />
      </div>
      <div className="project-card__meta">
        <span>{project.fileCountLabel}</span>
        <span>{project.reportCountLabel}</span>
        <span>{project.lastAnalyzedAt ? `Analysert ${formatDateTime(project.lastAnalyzedAt)}` : "Ikke analysert"}</span>
      </div>
      <div className="project-card__footer">Åpne prosjekt</div>
    </Link>
  );
}
