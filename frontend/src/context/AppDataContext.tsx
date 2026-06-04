import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getHealth, getProjects } from "../lib/api";
import type { HealthResponse, ProjectSummary } from "../types";

interface AppDataContextValue {
  projects: ProjectSummary[];
  projectsLoading: boolean;
  projectsError: string | null;
  projectWarnings: string[];
  health: HealthResponse | null;
  healthLoading: boolean;
  healthError: string | null;
  refresh: () => void;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [projectWarnings, setProjectWarnings] = useState<string[]>([]);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setProjectsLoading(true);
    setProjectsError(null);
    setProjectWarnings([]);

    getProjects()
      .then((response) => {
        if (controller.signal.aborted) {
          return;
        }
        setProjects(response.projects);
        setProjectWarnings(response.warnings);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setProjects([]);
        setProjectsError(error instanceof Error ? error.message : "Kunne ikke laste prosjekter.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setProjectsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [refreshIndex]);

  useEffect(() => {
    const controller = new AbortController();
    setHealthLoading(true);
    setHealthError(null);

    getHealth()
      .then((response) => {
        if (!controller.signal.aborted) {
          setHealth(response);
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setHealth(null);
        setHealthError(error instanceof Error ? error.message : "Kunne ikke lese helsestatus.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setHealthLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [refreshIndex]);

  const value: AppDataContextValue = {
    projects,
    projectsLoading,
    projectsError,
    projectWarnings,
    health,
    healthLoading,
    healthError,
    refresh: () => setRefreshIndex((value) => value + 1),
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

