import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { AppDataContext } from "./context/AppDataContext";

describe("App routes", () => {
  it("renders the about page at /about without sidebar nav crashes", () => {
    const markup = renderToStaticMarkup(
      <StaticRouter location="/about">
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
          <App />
        </AppDataContext.Provider>
      </StaticRouter>,
    );

    expect(markup).toContain("Om URN Nexus");
    expect(markup).toContain('href="/about"');
    expect(markup).toContain("Dashboard");
    expect(markup).toContain("Helse");
  });
});
