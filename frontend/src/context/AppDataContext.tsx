import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getAnalysisStatus, getHealth, getProjects, getSyncStatus, runSync } from "../lib/api";
import { APPLIANCE_BUSY_MESSAGE, SYNC_STALE_LOCK_WARNING, isLockBusyError } from "../lib/applianceStatus";
import { createProjectViewModels, filterVisibleProjects, showSampleProjectsInUi, type ProjectViewModel } from "../lib/projects";
import type { AnalysisStatusResponse, HealthResponse, SyncStatusResponse } from "../types";

const DAILY_SYNC_STORAGE_KEY = "urn-nexus:daily-onedrive-sync";
const DAILY_SYNC_TIMEOUT_MS = 25_000;
const DAILY_SYNC_POLL_INTERVAL_MS = 3000;
const DAILY_SYNC_TITLE = "Velkommen til Urban Reuse Norway's NEXUS verktøy";
const DAILY_SYNC_MESSAGE = "Vent et øyeblikk mens OneDrive synkroniseres";
const DAILY_SYNC_TIMEOUT_MESSAGE = "Synkronisering tar lengre tid enn forventet. Du kan fortsette med sist synkroniserte data.";
const DAILY_SYNC_FAILED_MESSAGE = "OneDrive-synkroniseringen feilet.";
const DAILY_SYNC_BACKGROUND_MESSAGE = "OneDrive synkroniseres i bakgrunnen.";

type DailySyncRecordStatus = "running" | "completed" | "failed" | "timeout";

interface DailySyncRecord {
  date: string;
  started_at: string | null;
  completed_at: string | null;
  status: DailySyncRecordStatus;
  last_error: string | null;
}

interface ApplianceStatusSnapshot {
  syncStatus: SyncStatusResponse;
  analysisStatus: AnalysisStatusResponse;
}

interface DailySyncState {
  mode: DailySyncRecordStatus;
  title: string;
  message: string;
  detail: string | null;
}

interface AppDataContextValue {
  projects: ProjectViewModel[];
  projectsLoading: boolean;
  projectsError: string | null;
  projectWarnings: string[];
  health: HealthResponse | null;
  healthLoading: boolean;
  healthError: string | null;
  dailySync?: DailySyncState | null;
  dismissDailySync?: () => void;
  refresh: () => void;
  removeProjectByName: (projectName: string) => void;
}

export const AppDataContext = createContext<AppDataContextValue | null>(null);

function getLocalDayKey(date = new Date()): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSameLocalDay(timestamp: string | null | undefined, dayKey: string): boolean {
  if (!timestamp) {
    return false;
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  return getLocalDayKey(date) === dayKey;
}

function isSameLocalDayAsToday(timestamp: string | null | undefined): boolean {
  return isSameLocalDay(timestamp, getLocalDayKey());
}

function readStoredSyncRecord(): DailySyncRecord | null {
  try {
    const raw = window.localStorage.getItem(DAILY_SYNC_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<DailySyncRecord> & { status?: string };
    if (
      typeof parsed.date !== "string" ||
      typeof parsed.status !== "string" ||
      !["running", "completed", "failed", "timeout"].includes(parsed.status)
    ) {
      return null;
    }
    return {
      date: parsed.date,
      started_at: typeof parsed.started_at === "string" ? parsed.started_at : null,
      completed_at: typeof parsed.completed_at === "string" ? parsed.completed_at : null,
      status: parsed.status as DailySyncRecordStatus,
      last_error: typeof parsed.last_error === "string" ? parsed.last_error : null,
    };
  } catch {
    return null;
  }
}

function storeSyncRecord(record: DailySyncRecord): void {
  try {
    window.localStorage.setItem(DAILY_SYNC_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Ignore storage failures and fall back to in-memory behavior for this session.
  }
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<ProjectViewModel[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [dailySync, setDailySync] = useState<DailySyncState | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const dailySyncBootstrappedRef = useRef(false);
  const dailySyncDismissedRef = useRef(false);

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

  useEffect(() => {
    if (dailySyncBootstrappedRef.current) {
      return;
    }
    dailySyncBootstrappedRef.current = true;

    let cancelled = false;
    let pollTimerId: number | undefined;
    let timeoutTimerId: number | undefined;
    let currentRecord: DailySyncRecord | null = readStoredSyncRecord();

    const clearPollTimer = () => {
      if (pollTimerId !== undefined) {
        window.clearTimeout(pollTimerId);
        pollTimerId = undefined;
      }
    };

    const clearTimeoutTimer = () => {
      if (timeoutTimerId !== undefined) {
        window.clearTimeout(timeoutTimerId);
        timeoutTimerId = undefined;
      }
    };

    const clearTimers = () => {
      clearPollTimer();
      clearTimeoutTimer();
    };

    const setModal = (state: DailySyncState | null) => {
      if (dailySyncDismissedRef.current && state !== null) {
        return;
      }
      setDailySync(state);
    };

    const persistRecord = (record: DailySyncRecord) => {
      currentRecord = record;
      storeSyncRecord(record);
    };

    const clearStoredRecord = () => {
      currentRecord = null;
      try {
        window.localStorage.removeItem(DAILY_SYNC_STORAGE_KEY);
      } catch {
        // Ignore storage failures and fall back to in-memory behavior for this session.
      }
    };

    const showRunningModal = (detail: string | null = DAILY_SYNC_BACKGROUND_MESSAGE, message = DAILY_SYNC_MESSAGE) => {
      setModal({
        mode: "running",
        title: DAILY_SYNC_TITLE,
        message,
        detail,
      });
    };

    const showBusyModal = () => {
      showRunningModal(null, APPLIANCE_BUSY_MESSAGE);
    };

    const showTimeoutModal = (detail = "OneDrive synkroniserer fortsatt i bakgrunnen.") => {
      setModal({
        mode: "timeout",
        title: DAILY_SYNC_TITLE,
        message: DAILY_SYNC_TIMEOUT_MESSAGE,
        detail,
      });
    };

    const showFailureModal = (detail: string) => {
      setModal({
        mode: "failed",
        title: DAILY_SYNC_TITLE,
        message: DAILY_SYNC_FAILED_MESSAGE,
        detail,
      });
    };

    const schedulePoll = (delayMs = DAILY_SYNC_POLL_INTERVAL_MS) => {
      clearPollTimer();
      pollTimerId = window.setTimeout(() => {
        pollTimerId = undefined;
        void pollSyncStatus();
      }, delayMs);
    };

    const scheduleTimeout = () => {
      if (timeoutTimerId !== undefined || currentRecord?.status !== "running") {
        return;
      }
      timeoutTimerId = window.setTimeout(() => {
        timeoutTimerId = undefined;
        if (cancelled || !currentRecord || currentRecord.status !== "running") {
          return;
        }
        persistRecord({
          ...currentRecord,
          status: "timeout",
          completed_at: null,
        });
        showTimeoutModal();
      }, DAILY_SYNC_TIMEOUT_MS);
    };

    async function readApplianceStatus(): Promise<ApplianceStatusSnapshot> {
      const [syncStatus, analysisStatus] = await Promise.all([getSyncStatus(), getAnalysisStatus()]);
      return { syncStatus, analysisStatus };
    }

    async function pollSyncStatus() {
      if (cancelled) {
        return;
      }

      try {
        const { syncStatus, analysisStatus } = await readApplianceStatus();
        if (cancelled) {
          return;
        }

        const analysisStartupBusy = analysisStatus.status === "startup_pending" || analysisStatus.startup_grace_active;
        const applianceActivity = syncStatus.activity !== "idle" ? syncStatus.activity : analysisStartupBusy ? "analysis" : analysisStatus.activity;
        const syncRunning = syncStatus.running || (syncStatus.lock_exists && applianceActivity === "sync");
        const analysisRunning = analysisStatus.running || analysisStartupBusy || (analysisStatus.lock_exists && applianceActivity === "analysis");
        const anyLiveLock = syncStatus.lock_exists || analysisStatus.lock_exists || analysisStartupBusy;

        if (syncRunning) {
          const startedAt = syncStatus.last_started_at ?? currentRecord?.started_at ?? new Date().toISOString();
          const nextRecord: DailySyncRecord = {
            date: currentRecord?.date ?? getLocalDayKey(new Date(startedAt)),
            started_at: startedAt,
            completed_at: null,
            status: currentRecord?.status === "timeout" ? "timeout" : "running",
            last_error: null,
          };
          if (
            !currentRecord ||
            currentRecord.started_at !== nextRecord.started_at ||
            currentRecord.status !== nextRecord.status ||
            currentRecord.date !== nextRecord.date
          ) {
            persistRecord(nextRecord);
          }
          if (nextRecord.status === "timeout") {
            showTimeoutModal();
          } else {
            showRunningModal();
            scheduleTimeout();
          }
          schedulePoll();
          return;
        }

        if (analysisRunning || anyLiveLock) {
          if (currentRecord?.status === "failed" && isLockBusyError(currentRecord.last_error)) {
            clearStoredRecord();
          }
          showBusyModal();
          schedulePoll();
          return;
        }

        const normalizedStatus = syncStatus.status.trim().toLowerCase();
        const startedAt = syncStatus.last_started_at ?? currentRecord?.started_at ?? null;
        const completedAt = syncStatus.last_completed_at ?? new Date().toISOString();
        const backendLockError = isLockBusyError(syncStatus.last_error);
        const storedLockError = isLockBusyError(currentRecord?.last_error);

        if (backendLockError || storedLockError) {
          clearStoredRecord();
          clearTimers();
          setDailySync(null);
          return;
        }

        if (normalizedStatus.includes("fail") || normalizedStatus.includes("error") || Boolean(syncStatus.last_error)) {
          const detail = syncStatus.last_error ?? currentRecord?.last_error ?? "Kunne ikke fullføre OneDrive-synkronisering.";
          persistRecord({
            date: currentRecord?.date ?? getLocalDayKey(),
            started_at: startedAt,
            completed_at: completedAt,
            status: "failed",
            last_error: detail,
          });
          clearTimers();
          showFailureModal(detail);
          return;
        }

        if (normalizedStatus.includes("complete") || normalizedStatus.includes("skipped") || Boolean(syncStatus.last_completed_at)) {
          persistRecord({
            date: currentRecord?.date ?? getLocalDayKey(),
            started_at: startedAt,
            completed_at: completedAt,
            status: "completed",
            last_error: null,
          });
          clearTimers();
          if (!dailySyncDismissedRef.current) {
            setDailySync(null);
          }
          setRefreshIndex((value) => value + 1);
          return;
        }

        if (currentRecord?.status === "timeout") {
          showTimeoutModal();
          schedulePoll(DAILY_SYNC_POLL_INTERVAL_MS);
          return;
        }

        if (currentRecord?.status === "running") {
          const detail = "Synkroniseringen stoppet uten å fullføre.";
          persistRecord({
            date: currentRecord.date,
            started_at: currentRecord.started_at,
            completed_at: completedAt,
            status: "failed",
            last_error: detail,
          });
          clearTimers();
          showFailureModal(detail);
          return;
        }

        clearTimers();
      } catch (error) {
        if (cancelled) {
          return;
        }
        const detail = error instanceof Error ? error.message : "Kunne ikke lese sync-status.";
        if (currentRecord?.status === "timeout") {
          showTimeoutModal(detail);
        } else {
          showRunningModal(detail);
        }
        schedulePoll(DAILY_SYNC_POLL_INTERVAL_MS);
      }
    }

    async function startNewDailySync(todayKey: string) {
      dailySyncDismissedRef.current = false;
      setModal({
        mode: "running",
        title: DAILY_SYNC_TITLE,
        message: DAILY_SYNC_MESSAGE,
        detail: "Klargjør OneDrive-synkronisering ...",
      });

      try {
        const response = await runSync();
        if (cancelled) {
          return;
        }

        const startedAt = response.started_at;
        const runningRecord: DailySyncRecord = {
          date: todayKey,
          started_at: startedAt,
          completed_at: null,
          status: "running",
          last_error: null,
        };
        persistRecord(runningRecord);
        showRunningModal(response.status === "already_running" ? "OneDrive synkroniseres allerede ..." : DAILY_SYNC_BACKGROUND_MESSAGE);
        scheduleTimeout();
        schedulePoll();
      } catch (error) {
        if (cancelled) {
          return;
        }

        try {
          const { syncStatus, analysisStatus } = await readApplianceStatus();
          if (cancelled) {
            return;
          }

          const applianceActivity = syncStatus.activity !== "idle" ? syncStatus.activity : analysisStatus.activity;
          const syncRunning = syncStatus.running || (syncStatus.lock_exists && applianceActivity === "sync");
          const analysisRunning = analysisStatus.running || (analysisStatus.lock_exists && applianceActivity === "analysis");
          const anyLiveLock = syncStatus.lock_exists || analysisStatus.lock_exists;

          if (syncRunning) {
            const startedAt = syncStatus.last_started_at ?? new Date().toISOString();
            persistRecord({
              date: todayKey,
              started_at: startedAt,
              completed_at: null,
              status: "running",
              last_error: null,
            });
            showRunningModal();
            scheduleTimeout();
            schedulePoll();
            return;
          }

          if (analysisRunning || anyLiveLock) {
            showBusyModal();
            schedulePoll();
            return;
          }
        } catch {
          // fall through to error handling below
        }

        if (error instanceof Error && error.message === APPLIANCE_BUSY_MESSAGE) {
          clearStoredRecord();
          showBusyModal();
          schedulePoll();
          return;
        }

        if (error instanceof Error && isLockBusyError(error.message)) {
          clearStoredRecord();
          showFailureModal(SYNC_STALE_LOCK_WARNING);
          return;
        }

        showFailureModal(error instanceof Error ? error.message : "Kunne ikke starte OneDrive-synkronisering.");
      }
    }

    async function bootstrapDailySync() {
      const todayKey = getLocalDayKey();
      const storedRecord = currentRecord;

      try {
        const { syncStatus, analysisStatus } = await readApplianceStatus();
        if (cancelled) {
          return;
        }

        const backendLockError = isLockBusyError(syncStatus.last_error);
        const storedLockError = isLockBusyError(storedRecord?.last_error);
        const activeStoredRecord = backendLockError || storedLockError ? null : storedRecord;
        const applianceActivity = syncStatus.activity !== "idle" ? syncStatus.activity : analysisStatus.activity;
        const syncRunning = syncStatus.running || (syncStatus.lock_exists && applianceActivity === "sync");
        const analysisRunning = analysisStatus.running || (analysisStatus.lock_exists && applianceActivity === "analysis");
        const anyLiveLock = syncStatus.lock_exists || analysisStatus.lock_exists;

        if (syncRunning) {
          const record: DailySyncRecord = activeStoredRecord?.date === todayKey && activeStoredRecord.status === "timeout"
            ? activeStoredRecord
            : {
                date: todayKey,
                started_at: syncStatus.last_started_at ?? activeStoredRecord?.started_at ?? new Date().toISOString(),
                completed_at: null,
                status: activeStoredRecord?.status === "timeout" ? "timeout" : "running",
                last_error: null,
              };
          persistRecord(record);
          if (record.status === "timeout") {
            showTimeoutModal();
          } else {
            showRunningModal();
            scheduleTimeout();
          }
          schedulePoll();
          return;
        }

        if (analysisRunning || anyLiveLock) {
          if (storedRecord?.status === "failed" && storedLockError) {
            clearStoredRecord();
          }
          showBusyModal();
          schedulePoll();
          return;
        }

        if (backendLockError || storedLockError) {
          clearStoredRecord();
        }

        const normalizedStatus = syncStatus.status.trim().toLowerCase();
        const backendVisibleError = backendLockError ? null : syncStatus.last_error;
        const backendCompletedToday = Boolean(syncStatus.last_completed_at && isSameLocalDayAsToday(syncStatus.last_completed_at));
        const backendStartedToday = Boolean(syncStatus.last_started_at && isSameLocalDayAsToday(syncStatus.last_started_at));
        const backendFailed = !backendLockError && (normalizedStatus.includes("fail") || normalizedStatus.includes("error") || Boolean(backendVisibleError));

        if (backendFailed) {
          const detail = backendVisibleError ?? activeStoredRecord?.last_error ?? DAILY_SYNC_FAILED_MESSAGE;
          persistRecord({
            date: todayKey,
            started_at: syncStatus.last_started_at ?? activeStoredRecord?.started_at ?? null,
            completed_at: syncStatus.last_completed_at ?? new Date().toISOString(),
            status: "failed",
            last_error: detail,
          });
          showFailureModal(detail);
          return;
        }

        if (backendCompletedToday) {
          persistRecord({
            date: todayKey,
            started_at: syncStatus.last_started_at ?? activeStoredRecord?.started_at ?? null,
            completed_at: syncStatus.last_completed_at ?? new Date().toISOString(),
            status: "completed",
            last_error: null,
          });
          if (activeStoredRecord?.status === "running" || activeStoredRecord?.status === "timeout") {
            setRefreshIndex((value) => value + 1);
          }
          return;
        }

        if (activeStoredRecord?.date === todayKey) {
          if (activeStoredRecord.status === "completed") {
            return;
          }
          if (activeStoredRecord.status === "failed") {
            showFailureModal(activeStoredRecord.last_error ?? DAILY_SYNC_FAILED_MESSAGE);
            return;
          }
          if (activeStoredRecord.status === "timeout") {
            showTimeoutModal(activeStoredRecord.last_error ?? "OneDrive synkroniserer fortsatt i bakgrunnen.");
            schedulePoll();
            return;
          }
          if (activeStoredRecord.status === "running") {
            showRunningModal();
            scheduleTimeout();
            schedulePoll();
            return;
          }
        }

        if (backendStartedToday && !backendLockError && !storedLockError) {
          return;
        }

        await startNewDailySync(todayKey);
      } catch (error) {
        if (cancelled) {
          return;
        }
        showFailureModal(error instanceof Error ? error.message : "Kunne ikke lese sync-status.");
      }
    }

    void bootstrapDailySync();
    return () => {
      cancelled = true;
      clearTimers();
    };
  }, []);

  const projectWarnings = useMemo(
    () =>
      Array.from(new Set(projects.flatMap((project) => project.issues.map((issue) => issue.message)).filter((message) => message.trim().length > 0))),
    [projects],
  );

  const dismissDailySync = () => {
    dailySyncDismissedRef.current = true;
    setDailySync(null);
  };

  const value: AppDataContextValue = {
    projects,
    projectsLoading,
    projectsError,
    projectWarnings,
    health,
    healthLoading,
    healthError,
    dailySync,
    dismissDailySync,
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
