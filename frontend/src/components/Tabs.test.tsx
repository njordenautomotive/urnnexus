import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { describe, expect, it } from "vitest";
import { Tabs } from "./Tabs";

const items = [
  { to: "/projects/Alpha", label: "Oversikt" },
  { to: "/projects/Alpha/files", label: "Filer" },
  { to: "/projects/Alpha/reports", label: "Rapporter" },
];

function isActive(markup: string, label: string): boolean {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`<a[^>]*class="[^"]*tabs__item--active[^"]*"[^>]*>\\s*${escapedLabel}\\s*<\\/a>`).test(markup);
}

function renderTabs(location: string): string {
  return renderToStaticMarkup(
    <StaticRouter location={location}>
      <Tabs items={items} />
    </StaticRouter>,
  );
}

describe("Tabs", () => {
  it("marks only oversikt active on the overview route", () => {
    const markup = renderTabs("/projects/Alpha");

    expect(isActive(markup, "Oversikt")).toBe(true);
    expect(isActive(markup, "Filer")).toBe(false);
    expect(isActive(markup, "Rapporter")).toBe(false);
  });

  it("marks only files active on the files route", () => {
    const markup = renderTabs("/projects/Alpha/files");

    expect(isActive(markup, "Oversikt")).toBe(false);
    expect(isActive(markup, "Filer")).toBe(true);
    expect(isActive(markup, "Rapporter")).toBe(false);
  });

  it("marks only reports active on the reports route", () => {
    const markup = renderTabs("/projects/Alpha/reports");

    expect(isActive(markup, "Oversikt")).toBe(false);
    expect(isActive(markup, "Filer")).toBe(false);
    expect(isActive(markup, "Rapporter")).toBe(true);
  });
});
