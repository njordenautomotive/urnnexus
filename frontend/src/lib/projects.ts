import type { ProjectSummary } from "../types";

export const showSampleProjectsInUi = import.meta.env.VITE_SHOW_SAMPLE_PROJECTS === "true";

export function isSampleProject(project: ProjectSummary): boolean {
  return project.is_sample_project;
}

export function filterVisibleProjects(projects: ProjectSummary[], includeSampleProjects = showSampleProjectsInUi): ProjectSummary[] {
  if (includeSampleProjects) {
    return projects;
  }
  return projects.filter((project) => !isSampleProject(project));
}

export function projectActivityTimestamp(project: ProjectSummary): string | null {
  return project.last_synced_at ?? project.latest_comment_modified_at ?? project.last_analyzed_at;
}

export function displayProjectPath(relativeProjectPath: string): string {
  const prefix = "AnbudAppliance/";
  return relativeProjectPath.startsWith(prefix) ? relativeProjectPath.slice(prefix.length) : relativeProjectPath;
}

export function sortProjectsByActivity(projects: ProjectSummary[]): ProjectSummary[] {
  return [...projects].sort((left, right) => {
    const leftTime = projectActivityTimestamp(left) ? Date.parse(projectActivityTimestamp(left) as string) : 0;
    const rightTime = projectActivityTimestamp(right) ? Date.parse(projectActivityTimestamp(right) as string) : 0;
    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }
    return left.display_name.localeCompare(right.display_name, "nb");
  });
}
