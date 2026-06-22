import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AboutPage } from "./AboutPage";

describe("AboutPage", () => {
  it("explains Nexus, the analysis engine, OneDrive flow, and report boundaries", () => {
    const markup = renderToStaticMarkup(<AboutPage />);

    expect(markup).toContain("Om URN Nexus");
    expect(markup).toContain("Hva er URN Nexus?");
    expect(markup).toContain("Hva er URN Analysis Engine?");
    expect(markup).toContain("OneDrive");
    expect(markup).toContain("pre-kalkyleguide");
    expect(markup).toContain("Hva rapporten ikke er");
    expect(markup).toContain("kvalitetssikring");
    expect(markup).not.toContain("Appliance");
  });
});
