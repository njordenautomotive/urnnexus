import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteProject, runSync } from "./api";

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
    expect(response.synced).toBe(true);
  });
});
