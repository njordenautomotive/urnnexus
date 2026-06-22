// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppDataContext } from "../context/AppDataContext";
import { AppLayout, THEME_STORAGE_KEY } from "./Layout";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let mountedRoot: Root | null = null;

function mockSystemTheme(matchesDark: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: matchesDark,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function renderLayout() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mountedRoot = root;

  act(() => {
    root.render(
      <MemoryRouter initialEntries={["/health"]}>
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
              <Route path="/health" element={<div>Helse</div>} />
            </Route>
          </Routes>
        </AppDataContext.Provider>
      </MemoryRouter>,
    );
  });

  const button = container.querySelector(".theme-toggle") as HTMLButtonElement | null;
  if (!button) {
    throw new Error("Fant ikke theme-toggle.");
  }
  return { button, container };
}

afterEach(() => {
  act(() => {
    mountedRoot?.unmount();
  });
  mountedRoot = null;
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.style.colorScheme = "";
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("AppLayout theme switch", () => {
  it("uses system preference when no theme is stored", () => {
    mockSystemTheme(true);

    const { button } = renderLayout();

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it("toggles theme and persists it in localStorage", () => {
    mockSystemTheme(false);

    const { button } = renderLayout();

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(button.getAttribute("aria-label")).toBe("Bytt til mørk modus");

    act(() => {
      button.click();
    });

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(button.getAttribute("aria-label")).toBe("Bytt til lys modus");
  });
});
