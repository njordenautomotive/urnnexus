import { useState } from "react";
import { AppHeader } from "../components/Layout";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { ProjectCard } from "../components/ProjectCard";
import { StatCard } from "../components/StatCard";
import { useAppData } from "../context/AppDataContext";
import { formatDateTime } from "../lib/api";
import type { ProjectSummary } from "../types";

const STATUS_OPTIONS = [
  { value: "all", label: "Alle statuser" },
  { value: "completed", label: "Fullført" },
  { value: "completed_with_warnings", label: "Fullført med varsler" },
  { value: "skipped_no_changes", label: "Ingen endringer" },
  { value: "failed", label: "Feilet" },
];

function sortProjects(projects: ProjectSummary[]): ProjectSummary[] {
  return [...projects].sort((left, right) => {
    const leftTime = left.last_analyzed_at ? Date.parse(left.last_analyzed_at) : 0;
    const rightTime = right.last_analyzed_at ? Date.parse(right.last_analyzed_at) : 0;
    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }
    return left.project_name.localeCompare(right.project_name, "nb");
  });
}

export function ProjectsPage() {
  const { projects, projectsLoading, projectsError, projectWarnings, refresh } = useAppData();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const normalizedQuery = query.trim().toLowerCase();
  const filteredProjects = sortProjects(
    projects.filter((project) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        project.project_name.toLowerCase().includes(normalizedQuery) ||
        project.project_path.toLowerCase().includes(normalizedQuery);
      const matchesStatus = statusFilter === "all" || project.status === statusFilter;
      return matchesQuery && matchesStatus;
    }),
  );

  const analyzedCount = projects.filter((project) => project.last_analyzed_at !== null).length;
  const totalFiles = projects.reduce((sum, project) => sum + project.file_count, 0);
  const totalReports = projects.reduce((sum, project) => sum + project.report_count, 0);

  if (projectsError) {
    return (
      <ErrorState
        title="Kunne ikke laste prosjektlisten"
        description={projectsError}
        action={
          <button type="button" className="button button--secondary" onClick={refresh}>
            Prøv igjen
          </button>
        }
      />
    );
  }

  return (
    <div className="page-stack">
      <AppHeader title="Prosjekter" description="Utforsk alle prosjektene appliance kjenner til, uten mock-data og uten analyser fra denne frontenden." />

      <section className="surface surface--padded">
        <div className="stats-grid">
          <StatCard label="Prosjekter" value={projects.length.toLocaleString("nb-NO")} note="Oppdaget av appliance" tone="accent" />
          <StatCard label="Analyserte" value={analyzedCount.toLocaleString("nb-NO")} note="Har minst én analysert kjøring" tone="success" />
          <StatCard label="Filer" value={totalFiles.toLocaleString("nb-NO")} note="Summert over prosjektlisten" tone="neutral" />
          <StatCard label="Rapporter" value={totalReports.toLocaleString("nb-NO")} note="Summert over prosjektlisten" tone="warning" />
        </div>

        {projectWarnings.length > 0 ? (
          <div className="notice notice--warning">
            <div className="notice__title">Varsler fra appliance</div>
            <ul className="notice__list">
              {projectWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="toolbar">
          <label className="field">
            <span className="field__label">Søk</span>
            <input
              type="search"
              className="input"
              placeholder="Søk i navn eller sti"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Status</span>
            <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="toolbar__meta">
            <div className="toolbar__meta-title">{filteredProjects.length.toLocaleString("nb-NO")} treff</div>
            <div className="toolbar__meta-note">
              {filteredProjects.length > 0
                ? filteredProjects[0].last_analyzed_at
                  ? `Sist oppdatert ${formatDateTime(filteredProjects[0].last_analyzed_at)}`
                  : "Viste prosjekter er ikke analysert ennå"
                : "Ingen prosjekter matcher filteret"}
            </div>
          </div>
        </div>

        {projectsLoading ? (
          <div className="project-grid project-grid--loading">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="project-card project-card--placeholder">
                <div className="placeholder placeholder--title" />
                <div className="placeholder placeholder--line" />
                <div className="placeholder placeholder--line" />
              </div>
            ))}
          </div>
        ) : filteredProjects.length > 0 ? (
          <div className="project-grid">
            {filteredProjects.map((project) => (
              <ProjectCard key={project.project_name} project={project} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Ingen treff"
            description="Ingen prosjekter matcher søket eller statusfilteret akkurat nå."
          />
        )}
      </section>
    </div>
  );
}
