import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createProjectViewModel } from "../lib/projects";
import type { ProjectPageContext } from "./ProjectPage";
import { ProjectFilesPage } from "./ProjectFilesPage";
import type { FileNode, ProjectDetailResponse, ProjectFilesResponse, ProjectSummary } from "../types";

const mocks = vi.hoisted(() => ({
  reloadFiles: vi.fn(),
  reloadProject: vi.fn(),
  filesResponse: undefined as ProjectFilesResponse | undefined,
  projectContext: undefined as ProjectPageContext | undefined,
}));

vi.mock("../lib/useResource", () => ({
  useResource: () => ({
    data: mocks.filesResponse,
    loading: false,
    error: null,
    reload: mocks.reloadFiles,
  }),
}));

vi.mock("./ProjectPage", async () => {
  const actual = await vi.importActual<typeof import("./ProjectPage")>("./ProjectPage");
  return {
    ...actual,
    useProjectPageContext: () => mocks.projectContext,
  };
});

function makeFile(name: string, relativePath: string): FileNode {
  return {
    name,
    path: relativePath,
    relative_path: relativePath,
    display_name: name,
    kind: "file",
    file_count: 1,
    folder_category: null,
    extension: name.split(".").pop() ?? null,
    size_bytes: 1024,
    modified_at: "2026-06-08T10:00:00+02:00",
    open_url: null,
    download_url: null,
    children: [],
  };
}

function makeFolder(name: string, relativePath: string, children: FileNode[]): FileNode {
  return {
    name,
    path: relativePath || ".",
    relative_path: relativePath,
    display_name: name,
    kind: "folder",
    file_count: children.reduce((sum, child) => sum + (child.kind === "file" ? 1 : child.file_count), 0),
    folder_category: null,
    extension: null,
    size_bytes: null,
    modified_at: null,
    children,
  };
}

const projectSummary: ProjectSummary = {
  project_name: "Bryn Skole",
  display_name: "Bryn Skole",
  source_label: "OneDrive",
  relative_project_path: "Urban_Reuse_Norway/Bryn Skole",
  hidden_internal_path: "/home/anbudklient/appliance/runtime/Bryn Skole",
  last_synced_at: "2026-06-08T08:00:00+02:00",
  latest_comment_document: "Bryn Skole - Kommentardokument.docx",
  latest_comment_document_open_url: null,
  latest_comment_created_at: "2026-06-08T08:15:00+02:00",
  latest_comment_modified_at: "2026-06-08T08:15:00+02:00",
  comment_document_count: 1,
  is_sample_project: false,
  project_path: "/home/anbudklient/appliance/runtime/Bryn Skole",
  last_analyzed_at: "2026-06-08T08:15:00+02:00",
  status: "completed",
  file_count: 3,
  report_count: 1,
  warnings: [],
  errors: [],
};

const projectContext: ProjectPageContext = {
  project: createProjectViewModel(projectSummary),
  projectDetail: {
    ...projectSummary,
    analysis: null,
    reports: [],
  } satisfies ProjectDetailResponse,
  reloadProject: mocks.reloadProject,
};

const filesResponse: ProjectFilesResponse = {
  display_name: "Bryn Skole",
  source_label: "OneDrive",
  relative_project_path: "Urban_Reuse_Norway/Bryn Skole",
  hidden_internal_path: "/home/anbudklient/appliance/runtime/Bryn Skole",
  last_synced_at: "2026-06-08T08:00:00+02:00",
  latest_comment_document: "Bryn Skole - Kommentardokument.docx",
  latest_comment_document_open_url: null,
  latest_comment_created_at: "2026-06-08T08:15:00+02:00",
  latest_comment_modified_at: "2026-06-08T08:15:00+02:00",
  comment_document_count: 1,
  is_sample_project: false,
  project_name: "Bryn Skole",
  project_path: "/home/anbudklient/appliance/runtime/Bryn Skole",
  total_files: 3,
  file_tree: makeFolder("", "", [
    makeFolder("Anbud", "Anbud", [
      makeFile("tilbud.pdf", "Anbud/tilbud.pdf"),
      makeFolder("Vedlegg", "Anbud/Vedlegg", [makeFile("dyp.docx", "Anbud/Vedlegg/dyp.docx")]),
    ]),
    makeFolder("Tegninger", "Tegninger", []),
    makeFile("rot.docx", "rot.docx"),
  ]),
  filters: {
    folder_categories: [],
    extensions: [],
  },
  warnings: [],
  errors: [],
};

mocks.filesResponse = filesResponse;
mocks.projectContext = projectContext;

describe("ProjectFilesPage", () => {
  it("renders only the first level of the active folder by default", () => {
    const markup = renderToStaticMarkup(<ProjectFilesPage />);

    expect(markup).toContain("Rot");
    expect(markup).toContain("Anbud");
    expect(markup).toContain("Tegninger");
    expect(markup).toContain("rot.docx");
    expect(markup).not.toContain("dyp.docx");
    expect(markup).not.toContain("folder-tree-panel");
    expect((markup.match(/file-browser-row--file/g) ?? []).length).toBe(1);
  });
});
