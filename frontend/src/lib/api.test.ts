import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteProject, getAnalysisStatus, runAnalysis, runSync } from "./api";

describe("api sync", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls the sync endpoint for the OneDrive sync button flow", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          job_id: "sync-job",
          running: true,
          started_at: "2026-06-08T08:00:00+02:00",
          status: "started",
          sync_only: true,
          analysis_started: false,
          reports_generated: 0,
          projects_synced: 0,
          files_changed: 0,
          reports_found: 0,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const response = await runSync();

    expect(fetchMock).toHaveBeenCalledWith("/api/sync/run", expect.objectContaining({ method: "POST" }));
    expect(response.sync_only).toBe(true);
    expect(response.analysis_started).toBe(false);
    expect(response.reports_generated).toBe(0);
  });

  it("calls the delete endpoint for OneDrive project deletion", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          project_name: "Bryn Skole",
          deleted_remote_path: "AnbudAppliance/Urban_Reuse_Norway/Bryn Skole",
          deleted: true,
          existed: true,
          synced: true,
          message: "Prosjektet ble slettet i OneDrive og fjernet fra Nexus.",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const response = await deleteProject("Bryn Skole");

    expect(fetchMock).toHaveBeenCalledWith("/api/projects/Bryn%20Skole", expect.objectContaining({ method: "DELETE" }));
    expect(response.deleted_remote_path).toBe("AnbudAppliance/Urban_Reuse_Norway/Bryn Skole");
    expect(response.deleted).toBe(true);
    expect(response.existed).toBe(true);
    expect(response.synced).toBe(true);
  });

  it("calls the analysis endpoint for the Analysis page flow", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          job_id: "analysis-job",
          running: true,
          started_at: "2026-06-09T09:00:00+02:00",
          status: "started",
          analysis_started: true,
          reports_generated: 0,
          projects_synced: 0,
          files_changed: 0,
          reports_found: 0,
          email_mode: "daily_digest",
          project_name: "Bryn Skole",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const response = await runAnalysis({ project_name: "Bryn Skole", email_mode: "daily_digest" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/analysis/run",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          project_name: "Bryn Skole",
          email_mode: "daily_digest",
        }),
      }),
    );
    expect(response.analysis_started).toBe(true);
    expect(response.reports_generated).toBe(0);
    expect(response.email_mode).toBe("daily_digest");
  });

  it("reads the analysis status endpoint for progress refresh", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          running: false,
          job_id: "analysis-job",
          last_started_at: "2026-06-09T09:00:00+02:00",
          last_completed_at: "2026-06-09T09:15:00+02:00",
          last_error: null,
          projects_synced: 1,
          files_changed: 2,
          reports_found: 1,
          reports_generated: 1,
          email_mode: "immediate",
          project_name: "Bryn Skole",
          status: "completed",
          analysis_started: false,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const response = await getAnalysisStatus();

    expect(fetchMock).toHaveBeenCalledWith("/api/analysis/status", expect.objectContaining({ headers: { Accept: "application/json" } }));
    expect(response.running).toBe(false);
    expect(response.reports_generated).toBe(1);
    expect(response.email_mode).toBe("immediate");
  });
});
