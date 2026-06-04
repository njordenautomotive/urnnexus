import { describe, expect, it } from "vitest";
import { countFilesInTree, filterFileTree } from "./fileTree";
import type { FileNode } from "../types";

const sampleTree: FileNode = {
  name: "Prosjekt",
  path: "/Prosjekt",
  kind: "folder",
  file_count: 3,
  folder_category: null,
  extension: null,
  size_bytes: null,
  modified_at: null,
  children: [
    {
      name: "Anbud",
      path: "/Prosjekt/Anbud",
      kind: "folder",
      file_count: 2,
      folder_category: "documents",
      extension: null,
      size_bytes: null,
      modified_at: null,
      children: [
        {
          name: "tilbud.pdf",
          path: "/Prosjekt/Anbud/tilbud.pdf",
          kind: "file",
          file_count: 0,
          folder_category: null,
          extension: "pdf",
          size_bytes: 1024,
          modified_at: null,
          children: [],
        },
        {
          name: "notat.docx",
          path: "/Prosjekt/Anbud/notat.docx",
          kind: "file",
          file_count: 0,
          folder_category: null,
          extension: "docx",
          size_bytes: 2048,
          modified_at: null,
          children: [],
        },
      ],
    },
    {
      name: "Tegninger",
      path: "/Prosjekt/Tegninger",
      kind: "folder",
      file_count: 1,
      folder_category: "drawings",
      extension: null,
      size_bytes: null,
      modified_at: null,
      children: [
        {
          name: "plan.ifc",
          path: "/Prosjekt/Tegninger/plan.ifc",
          kind: "file",
          file_count: 0,
          folder_category: null,
          extension: "ifc",
          size_bytes: 4096,
          modified_at: null,
          children: [],
        },
      ],
    },
  ],
};

describe("fileTree helpers", () => {
  it("counts files recursively", () => {
    expect(countFilesInTree(sampleTree)).toBe(3);
  });

  it("filters tree by extension and keeps matching ancestors", () => {
    const filtered = filterFileTree(sampleTree, { extension: "pdf", folderCategory: null });
    expect(filtered).not.toBeNull();
    expect(filtered?.children).toHaveLength(1);
    expect(filtered?.children[0].name).toBe("Anbud");
    expect(filtered?.children[0].children).toHaveLength(1);
    expect(filtered?.children[0].children[0].name).toBe("tilbud.pdf");
  });

  it("filters tree by folder category", () => {
    const filtered = filterFileTree(sampleTree, { extension: null, folderCategory: "drawings" });
    expect(filtered).not.toBeNull();
    expect(filtered?.children).toHaveLength(1);
    expect(filtered?.children[0].name).toBe("Tegninger");
  });
});
