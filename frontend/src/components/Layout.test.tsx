import { renderToStaticMarkup } from "react-dom/server";
import { Route, Routes } from "react-router-dom";
import { StaticRouter } from "react-router-dom/server";
import { describe, expect, it } from "vitest";
import { AppDataContext } from "../context/AppDataContext";
import { AppHeader, AppLayout, ProjectHeader } from "./Layout";

describe("AppLayout", () => {
  it("shows the compact sidebar brand and Norwegian health label", () => {
    const markup = renderToStaticMarkup(
      <StaticRouter location="/">
        <AppDataContext.Provider
          value={{
            projects: [],
            projectsLoading: false,
            projectsError: null,
            projectWarnings: [],
            health: null,
            healthLoading: false,
            healthError: null,
            refresh: () => undefined,
            removeProjectByName: () => undefined,
          }}
        >
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<div>Body</div>} />
            </Route>
          </Routes>
        </AppDataContext.Provider>
      </StaticRouter>,
    );

    expect(markup).toContain("URN Nexus");
    expect(markup).toContain("Analyse");
    expect(markup).toContain("Helse");
    expect(markup).not.toContain("Portal for OneDrive-prosjekter");
    expect(markup).not.toContain("Oppdater visning laster bare UI på nytt. Synk OneDrive oppdaterer cache fra OneDrive.");
  });

  it("renders app headers without eyebrow text by default", () => {
    const markup = renderToStaticMarkup(
      <AppDataContext.Provider
        value={{
          projects: [],
          projectsLoading: false,
          projectsError: null,
          projectWarnings: [],
          health: null,
          healthLoading: false,
          healthError: null,
          refresh: () => undefined,
          removeProjectByName: () => undefined,
        }}
      >
        <AppHeader title="Kontrollsenter" description="Oversikt over OneDrive-synk, rapporter, prosjekter og systemstatus." />
      </AppDataContext.Provider>,
    );

    expect(markup).toContain("Kontrollsenter");
    expect(markup).not.toContain("URN Nexus");
    expect(markup).not.toContain("page-header__eyebrow");
  });

  it("does not render source or path eyebrow text in project headers", () => {
    const markup = renderToStaticMarkup(
      <ProjectHeader
        title="Bryn Skole"
        breadcrumbPath="AnbudAppliance/Urban_Reuse_Norway/Bryn Skole"
        sourceLabel="OneDrive"
        status="completed"
      />,
    );

    expect(markup).toContain("Bryn Skole");
    expect(markup).not.toContain("AnbudAppliance/Urban_Reuse_Norway/Bryn Skole");
    expect(markup).not.toContain("OneDrive");
    expect(markup).not.toContain("project-header__eyebrow");
  });
});
