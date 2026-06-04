import { describe, expect, it } from "vitest";
import { formatBytes, formatDuration, projectUrl, safeDecodeProjectName } from "./api";

describe("formatter helpers", () => {
  it("formats byte counts in human-readable units", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.50 KB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.00 MB");
  });

  it("formats short durations", () => {
    expect(formatDuration(59)).toBe("59s");
    expect(formatDuration(61)).toBe("1m 1s");
    expect(formatDuration(3660)).toBe("1t 1m");
  });

  it("builds and decodes project urls safely", () => {
    expect(projectUrl("Bryn Skole")).toBe("/projects/Bryn%20Skole");
    expect(projectUrl("TestProsjekt#1", "files")).toBe("/projects/TestProsjekt%231/files");
    expect(safeDecodeProjectName("TestProsjekt%231")).toBe("TestProsjekt#1");
  });
});

