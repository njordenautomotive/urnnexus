import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceRoot = dirname(fileURLToPath(import.meta.url));

describe("theme styles", () => {
  it("defines light polish tokens and dark-mode theme tokens", () => {
    const css = readFileSync(resolve(sourceRoot, "styles.css"), "utf-8");

    expect(css).toContain("--shell-gradient: linear-gradient(180deg, #edf2f7 0%, #e2e8f1 100%)");
    expect(css).toContain("--surface-border: rgba(148, 163, 184, 0.18)");
    expect(css).toContain(":root[data-theme=\"dark\"]");
    expect(css).toContain("--input-border");
    expect(css).toContain(".theme-toggle");
    expect(css).toContain(".upload-progress");
    expect(css).toContain(".sidebar__logo");
    expect(css).toContain("width: 36px");
  });
});
