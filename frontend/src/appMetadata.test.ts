import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = resolve(frontendRoot, "public");

describe("app metadata", () => {
  it("registers URN Nexus favicon and install metadata in index.html", () => {
    const html = readFileSync(resolve(frontendRoot, "index.html"), "utf-8");

    expect(html).toContain("<title>URN Nexus – Kontrollsenter</title>");
    expect(html).toContain('rel="icon" href="/favicon.ico?v=0.1.9-logo2"');
    expect(html).toContain('sizes="16x16" href="/favicon-16x16.png?v=0.1.9-logo2"');
    expect(html).toContain('sizes="32x32" href="/favicon-32x32.png?v=0.1.9-logo2"');
    expect(html).toContain('sizes="48x48" href="/favicon-48x48.png?v=0.1.9-logo2"');
    expect(html).toContain('rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=0.1.9-logo2"');
    expect(html).toContain('rel="manifest" href="/site.webmanifest?v=0.1.9-logo2"');
  });

  it("uses cache-busted manifest icon references", () => {
    const manifest = JSON.parse(readFileSync(resolve(publicRoot, "site.webmanifest"), "utf-8")) as {
      icons: Array<{ src: string }>;
    };

    expect(manifest.icons.length).toBeGreaterThan(0);
    expect(manifest.icons.every((icon) => icon.src.includes("?v=0.1.9-logo2"))).toBe(true);
  });

  it("keeps all favicon assets in public for dev and production builds", () => {
    for (const asset of [
      "favicon.ico",
      "favicon-16x16.png",
      "favicon-32x32.png",
      "favicon-48x48.png",
      "apple-touch-icon.png",
      "android-chrome-192x192.png",
      "android-chrome-512x512.png",
      "mstile-150x150.png",
      "safari-pinned-tab.svg",
      "site.webmanifest",
    ]) {
      expect(existsSync(resolve(publicRoot, asset)), `${asset} should exist`).toBe(true);
    }
  });
});
