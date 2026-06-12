// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppLayout } from "../components/Layout";
import * as api from "../lib/api";
import { AppDataProvider } from "./AppDataContext";
import type { HealthResponse, ProjectListResponse, SyncRunResponse, SyncStatusResponse } from "../types";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const health: HealthResponse = {
  appliance_available: true,
  uptime_seconds: 120,
  uptime: "0:02:00",
  version: "0.1.5",
  appliance_root: "/home/anbudklient/appliance",
  discovered_projects: 0,
  last_synced_at: "2026-06-12T08:00:00+02:00",
  last_analyzed_at: null,
  latest_report_generated_at: null,
  project_count: 0,
  file_count: 0,
  report_count: 0,
  one_drive_status: "available",
  one_drive_detail: "OneDrive er tilgjengelig.",
  graph_write_status: "configured",
  graph_write_detail: "Graph-write er konfigurert.",
  openai_status: "configured",
  openai_detail: "OPENAI_API_KEY er satt.",
  smtp_status: "not_configured",
  smtp_detail: "SMTP_HOST mangler.",
  disk_total_bytes: 1000,
  disk_used_bytes: 500,
  disk_free_bytes: 500,
  cache_size_bytes: 250,
  errors_last_24h: 0,
  warnings_last_24h: 0,
};

let mountedRoot: Root | null = null;

function getLocalDayKey(date = new Date()): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function renderApp() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mountedRoot = root;

  act(() => {
    root.render(
      <MemoryRouter initialEntries={["/"]}>
        <AppDataProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<div>Body</div>} />
            </Route>
          </Routes>
        </AppDataProvider>
      </MemoryRouter>,
    );
  });

  return { container };
}

function makeProjectsResponse(): ProjectListResponse {
  return { count: 0, projects: [], warnings: [] };
}

function makeIdleSyncStatus(): SyncStatusResponse {
  return {
    running: false,
    job_id: null,
    last_started_at: null,
    last_completed_at: null,
    last_error: null,
    projects_synced: 0,
    files_changed: 0,
    reports_found: 0,
    status: "idle",
  };
}

function makeRunningSyncStatus(): SyncStatusResponse {
  return {
    running: true,
    job_id: "sync-job",
    last_started_at: "2026-06-12T08:00:00+02:00",
    last_completed_at: null,
    last_error: null,
    projects_synced: 0,
    files_changed: 0,
    reports_found: 0,
    status: "running",
  };
}

function makeCompletedSyncStatus(): SyncStatusResponse {
  return {
    running: false,
    job_id: "sync-job",
    last_started_at: "2026-06-12T08:00:00+02:00",
    last_completed_at: "2026-06-12T08:03:00+02:00",
    last_error: null,
    projects_synced: 2,
    files_changed: 4,
    reports_found: 1,
    status: "completed",
  };
}

function makeFailedSyncStatus(): SyncStatusResponse {
  return {
    running: false,
    job_id: "sync-job",
    last_started_at: "2026-06-12T08:00:00+02:00",
    last_completed_at: "2026-06-12T08:05:00+02:00",
    last_error: "OneDrive sync failed.",
    projects_synced: 0,
    files_changed: 0,
    reports_found: 0,
    status: "failed",
  };
}

function makeSyncRunResponse(): SyncRunResponse {
  return {
    job_id: "sync-job",
    running: true,
    started_at: "2026-06-12T08:00:00+02:00",
    status: "started",
    sync_only: true,
    analysis_started: false,
    reports_generated: 0,
    projects_synced: 0,
    files_changed: 0,
    reports_found: 0,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  act(() => {
    mountedRoot?.unmount();
  });
  vi.useRealTimers();
  mountedRoot = null;
  document.body.innerHTML = "";
  window.localStorage.clear();
});

describe("AppDataProvider daily sync", () => {
  it("starts the daily sync on first app open and closes the popup when it completes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-12T08:30:00+02:00"));

    const getProjectsSpy = vi.spyOn(api, "getProjects").mockResolvedValue(makeProjectsResponse());
    const getHealthSpy = vi.spyOn(api, "getHealth").mockResolvedValue(health);
    const getSyncStatusSpy = vi
      .spyOn(api, "getSyncStatus")
      .mockResolvedValueOnce(makeIdleSyncStatus())
      .mockResolvedValueOnce(makeCompletedSyncStatus());
    const runSyncSpy = vi.spyOn(api, "runSync").mockResolvedValue(makeSyncRunResponse());

    const { container } = renderApp();

    await act(async () => {
      for (let index = 0; index < 5; index += 1) {
        await Promise.resolve();
      }
    });

    expect(container.textContent).toContain("Velkommen til Urban Reuse Norway's NEXUS verktøy");
    expect(container.textContent).toContain("Vent et øyeblikk mens OneDrive synkroniseres");
    expect(runSyncSpy).toHaveBeenCalledTimes(1);
    expect(getSyncStatusSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(window.localStorage.getItem("urn-nexus:daily-onedrive-sync") ?? "null")).toMatchObject({
      status: "running",
      date: "2026-06-12",
    });

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).not.toContain("Vent et øyeblikk mens OneDrive synkroniseres");
    expect(getSyncStatusSpy).toHaveBeenCalledTimes(2);
    expect(getProjectsSpy).toHaveBeenCalledTimes(2);
    expect(getHealthSpy).toHaveBeenCalledTimes(2);
    expect(JSON.parse(window.localStorage.getItem("urn-nexus:daily-onedrive-sync") ?? "null")).toMatchObject({
      status: "completed",
      date: "2026-06-12",
    });
  });

  it("resumes an already running sync without starting a second job", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-12T09:00:00+02:00"));

    const getProjectsSpy = vi.spyOn(api, "getProjects").mockResolvedValue(makeProjectsResponse());
    const getHealthSpy = vi.spyOn(api, "getHealth").mockResolvedValue(health);
    const getSyncStatusSpy = vi
      .spyOn(api, "getSyncStatus")
      .mockResolvedValueOnce(makeRunningSyncStatus())
      .mockResolvedValueOnce(makeCompletedSyncStatus());
    const runSyncSpy = vi.spyOn(api, "runSync").mockResolvedValue(makeSyncRunResponse());

    const { container } = renderApp();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Velkommen til Urban Reuse Norway's NEXUS verktøy");
    expect(container.textContent).toContain("Vent et øyeblikk mens OneDrive synkroniseres");
    expect(runSyncSpy).not.toHaveBeenCalled();
    expect(getSyncStatusSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(window.localStorage.getItem("urn-nexus:daily-onedrive-sync") ?? "null")).toMatchObject({
      status: "running",
      date: "2026-06-12",
    });

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).not.toContain("Vent et øyeblikk mens OneDrive synkroniseres");
    expect(getSyncStatusSpy).toHaveBeenCalledTimes(2);
    expect(getProjectsSpy).toHaveBeenCalledTimes(2);
    expect(getHealthSpy).toHaveBeenCalledTimes(2);
  });

  it("switches to the timeout copy and lets the user continue if sync takes too long", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-12T09:30:00+02:00"));

    const getProjectsSpy = vi.spyOn(api, "getProjects").mockResolvedValue(makeProjectsResponse());
    const getHealthSpy = vi.spyOn(api, "getHealth").mockResolvedValue(health);
    const getSyncStatusSpy = vi
      .spyOn(api, "getSyncStatus")
      .mockResolvedValueOnce(makeIdleSyncStatus())
      .mockResolvedValue(makeRunningSyncStatus());
    const runSyncSpy = vi.spyOn(api, "runSync").mockResolvedValue(makeSyncRunResponse());

    const { container } = renderApp();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(runSyncSpy).toHaveBeenCalledTimes(1);
    expect(getSyncStatusSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(25_000);
      for (let index = 0; index < 5; index += 1) {
        await Promise.resolve();
      }
    });

    expect(container.textContent).toContain("Synkronisering tar lengre tid enn forventet. Du kan fortsette med sist synkroniserte data.");
    expect(container.textContent).toContain("Fortsett");
    expect(container.textContent).toContain("Se status");

    await act(async () => {
      const continueButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.trim() === "Fortsett");
      if (!continueButton) {
        throw new Error("Could not find Fortsett button");
      }
      continueButton.click();
      await Promise.resolve();
    });

    expect(container.textContent).not.toContain("Synkronisering tar lengre tid enn forventet. Du kan fortsette med sist synkroniserte data.");
    expect(getProjectsSpy).toHaveBeenCalledTimes(1);
    expect(getHealthSpy).toHaveBeenCalledTimes(1);
  });

  it("shows an error message and lets the user continue if sync fails", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-12T10:00:00+02:00"));

    const getProjectsSpy = vi.spyOn(api, "getProjects").mockResolvedValue(makeProjectsResponse());
    const getHealthSpy = vi.spyOn(api, "getHealth").mockResolvedValue(health);
    const getSyncStatusSpy = vi
      .spyOn(api, "getSyncStatus")
      .mockResolvedValueOnce(makeIdleSyncStatus())
      .mockResolvedValueOnce(makeFailedSyncStatus());
    const runSyncSpy = vi.spyOn(api, "runSync").mockResolvedValue(makeSyncRunResponse());

    const { container } = renderApp();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(runSyncSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("OneDrive-synkroniseringen feilet.");
    expect(container.textContent).toContain("Fortsett");
    expect(getSyncStatusSpy).toHaveBeenCalledTimes(2);
    expect(getProjectsSpy).toHaveBeenCalledTimes(1);
    expect(getHealthSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      const continueButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.trim() === "Fortsett");
      if (!continueButton) {
        throw new Error("Could not find Fortsett button");
      }
      continueButton.click();
      await Promise.resolve();
    });

    expect(container.textContent).not.toContain("OneDrive-synkroniseringen feilet.");
  });

  it("skips the daily sync after it has already completed today", async () => {
    const todayKey = getLocalDayKey();
    window.localStorage.setItem(
      "urn-nexus:daily-onedrive-sync",
      JSON.stringify({
        date: todayKey,
        started_at: "2026-06-12T08:00:00+02:00",
        completed_at: "2026-06-12T08:03:00+02:00",
        status: "completed",
        last_error: null,
      }),
    );

    const getProjectsSpy = vi.spyOn(api, "getProjects").mockResolvedValue(makeProjectsResponse());
    const getHealthSpy = vi.spyOn(api, "getHealth").mockResolvedValue(health);
    const getSyncStatusSpy = vi.spyOn(api, "getSyncStatus").mockResolvedValue(makeIdleSyncStatus());
    const runSyncSpy = vi.spyOn(api, "runSync").mockResolvedValue(makeSyncRunResponse());

    const { container } = renderApp();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).not.toContain("Velkommen til Urban Reuse Norway's NEXUS verktøy");
    expect(container.textContent).not.toContain("Vent et øyeblikk mens OneDrive synkroniseres");
    expect(runSyncSpy).not.toHaveBeenCalled();
    expect(getSyncStatusSpy).toHaveBeenCalledTimes(1);
    expect(getProjectsSpy).toHaveBeenCalledTimes(1);
    expect(getHealthSpy).toHaveBeenCalledTimes(1);
  });
});
