import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getHealth, getProjects } from "../lib/api";
import { createProjectViewModels, filterVisibleProjects, showSampleProjectsInUi, type ProjectViewModel } from "../lib/projects";
import type { HealthResponse } from "../types";

interface AppDataContextValue {
  projects: ProjectViewModel[];
  projectsLoading: boolean;
  projectsError: string | null;
  projectWarnings: string[];
  health: HealthResponse | null;
  healthLoading: boolean;
  healthError: string | null;
  refresh: () => void;
  removeProjectByName: (projectName: string) => void;
}

export const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<ProjectViewModel[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setProjectsLoading(true);
    setProjectsError(null);
    setHealthLoading(true);
    setHealthError(null);

    async function loadAppData() {
      try {
        const [projectsResult, healthResult] = await Promise.allSettled([
          Promise.resolve().then(() => getProjects({ includeSampleProjects: showSampleProjectsInUi })),
          Promise.resolve().then(() => getHealth()),
        ]);

        if (controller.signal.aborted) {
          return;
        }

        if (projectsResult.status === "fulfilled") {
          const visibleProjects = filterVisibleProjects(projectsResult.value.projects, showSampleProjectsInUi);
          const viewModels = createProjectViewModels(visibleProjects);
          setProjects(viewModels);
        } else {
          setProjects([]);
          setProjectsError(projectsResult.reason instanceof Error ? projectsResult.reason.message : "Kunne ikke laste prosjekter.");
        }

        if (healthResult.status === "fulfilled") {
          setHealth(healthResult.value);
        } else {
          setHealth(null);
          setHealthError(healthResult.reason instanceof Error ? healthResult.reason.message : "Kunne ikke lese helsestatus.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setProjectsLoading(false);
          setHealthLoading(false);
        }
      }
    }

    void loadAppData();
    return () => {
      controller.abort();
    };
  }, [refreshIndex]);

  const projectWarnings = useMemo(
    () =>
      Array.from(new Set(projects.flatMap((project) => project.issues.map((issue) => issue.message)).filter((message) => message.trim().length > 0))),
    [projects],
  );

  const value: AppDataContextValue = {
    projects,
    projectsLoading,
    projectsError,
    projectWarnings,
    health,
    healthLoading,
    healthError,
    refresh: () => setRefreshIndex((value) => value + 1),
    removeProjectByName: (projectName: string) =>
      setProjects((current) => current.filter((project) => project.projectName !== projectName)),
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataContextValue {
  const context = useContext(AppDataContext);
  if (context === null) {
    throw new Error("useAppData must be used within AppDataProvider");
  }
  return context;
}
