import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatusPill } from "./StatusPill";

describe("StatusPill", () => {
  it.each([
    ["SUCCESS", "Fullført"],
    ["latest", "Nyeste"],
    ["archived", "Arkiv"],
    ["NO_REPORT", "Ingen rapport"],
    ["PENDING", "Venter"],
    ["available", "Tilgjengelig"],
  ])("renders the dot to the left for %s", (status, label) => {
    const markup = renderToStaticMarkup(<StatusPill status={status} label={label} />);

    expect(markup).toContain("status-badge");
    expect(markup).toContain("status-badge__dot");
    expect(markup).toContain("status-badge__label");
    expect(markup.indexOf("status-badge__dot")).toBeLessThan(markup.indexOf("status-badge__label"));
    expect(markup).toContain(label);
  });
});
