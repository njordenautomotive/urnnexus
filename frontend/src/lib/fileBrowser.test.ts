import { describe, expect, it } from "vitest";
import { buildBreadcrumbs, buildSearchResults, getFolderNode, getVisibleFolderChildren } from "./fileBrowser";
import type { FileNode } from "../types";

function makeFile(name: string, relativePath: string, modifiedAt = "2026-06-08T10:00:00+02:00"): FileNode {
  return {
    name,
    path: relativePath,
    relative_path: relativePath,
    display_name: name,
    kind: "file",
    file_count: 1,
    folder_category: null,
    extension: name.includes(".") ? name.split(".").pop() ?? null : null,
    size_bytes: 1024,
    modified_at: modifiedAt,
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

const fileTree: FileNode = makeFolder("", "", [
  makeFolder("Anbud", "Anbud", [
    makeFile("tilbud.pdf", "Anbud/tilbud.pdf"),
    makeFolder("Vedlegg", "Anbud/Vedlegg", [makeFile("dyp.docx", "Anbud/Vedlegg/dyp.docx")]),
  ]),
  makeFolder("Tegninger", "Tegninger", []),
  makeFile("rot.docx", "rot.docx"),
]);

describe("fileBrowser helpers", () => {
  it("shows only direct children for the active folder", () => {
    const children = getVisibleFolderChildren(fileTree, null, "name");

    expect(children.map((child) => child.name)).toEqual(["Anbud", "Tegninger", "rot.docx"]);
    expect(children.some((child) => child.name === "dyp.docx")).toBe(false);
  });

  it("navigates to nested folders without expanding the whole tree", () => {
    const folder = getFolderNode(fileTree, "Anbud/Vedlegg");

    expect(folder?.name).toBe("Vedlegg");
    expect(getVisibleFolderChildren(folder, null, "name").map((child) => child.name)).toEqual(["dyp.docx"]);
  });

  it("builds breadcrumbs from the selected folder path", () => {
    expect(buildBreadcrumbs("Anbud/Vedlegg")).toEqual([
      { path: "Anbud", label: "Anbud" },
      { path: "Anbud/Vedlegg", label: "Vedlegg" },
    ]);
  });

  it("limits full-tree search results while keeping the total count", () => {
    const results = buildSearchResults(fileTree, "docx", null, "name", 1);

    expect(results.total).toBe(2);
    expect(results.items).toHaveLength(1);
    expect(results.items[0].path).toBe("Anbud/Vedlegg/dyp.docx");
  });
});
