import type { FileNode } from "../types";
import { flattenFileTree, type FlatFileRecord } from "./fileTree";

export type FileSortKey = "name" | "modified_desc" | "modified_asc" | "size_desc" | "size_asc" | "type";

function nodePath(node: FileNode): string {
  return node.relative_path || (node.path === "." ? "" : node.path);
}

function normalizeExtension(value: string | null | undefined): string {
  return String(value ?? "").replace(/^\./, "").toLowerCase();
}

function sortNodes(nodes: FileNode[], sortKey: FileSortKey): FileNode[] {
  return [...nodes].sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === "folder" ? -1 : 1;
    }
    if (sortKey === "type") {
      return normalizeExtension(left.extension).localeCompare(normalizeExtension(right.extension), "nb") || left.name.localeCompare(right.name, "nb");
    }
    if (sortKey === "size_desc" || sortKey === "size_asc") {
      const diff = (right.size_bytes ?? 0) - (left.size_bytes ?? 0);
      return sortKey === "size_desc" ? diff : -diff;
    }
    if (sortKey === "modified_desc" || sortKey === "modified_asc") {
      const leftTime = left.modified_at ? Date.parse(left.modified_at) : 0;
      const rightTime = right.modified_at ? Date.parse(right.modified_at) : 0;
      const diff = rightTime - leftTime;
      return sortKey === "modified_desc" ? diff : -diff;
    }
    return left.name.localeCompare(right.name, "nb");
  });
}

function sortFiles(files: FlatFileRecord[], sortKey: FileSortKey): FlatFileRecord[] {
  return [...files].sort((left, right) => {
    if (sortKey === "type") {
      return normalizeExtension(left.extension).localeCompare(normalizeExtension(right.extension), "nb") || left.displayName.localeCompare(right.displayName, "nb");
    }
    if (sortKey === "size_desc" || sortKey === "size_asc") {
      const diff = (right.sizeBytes ?? 0) - (left.sizeBytes ?? 0);
      return sortKey === "size_desc" ? diff : -diff;
    }
    if (sortKey === "modified_desc" || sortKey === "modified_asc") {
      const leftTime = left.modifiedAt ? Date.parse(left.modifiedAt) : 0;
      const rightTime = right.modifiedAt ? Date.parse(right.modifiedAt) : 0;
      const diff = rightTime - leftTime;
      return sortKey === "modified_desc" ? diff : -diff;
    }
    return left.displayName.localeCompare(right.displayName, "nb");
  });
}

function fileMatches(file: FlatFileRecord, query: string, selectedExtension: string | null): boolean {
  if (selectedExtension !== null && normalizeExtension(file.extension) !== normalizeExtension(selectedExtension)) {
    return false;
  }
  const needle = query.trim().toLowerCase();
  return !needle || `${file.displayName} ${file.path}`.toLowerCase().includes(needle);
}

function fileNodeMatches(node: FileNode, selectedExtension: string | null): boolean {
  if (selectedExtension === null) {
    return true;
  }
  return normalizeExtension(node.extension) === normalizeExtension(selectedExtension);
}

export function getFolderNode(root: FileNode | null, selectedPath: string): FileNode | null {
  if (!root || root.kind !== "folder") {
    return null;
  }
  const path = selectedPath.trim();
  if (!path) {
    return root;
  }
  if (nodePath(root) === path) {
    return root;
  }
  for (const child of root.children) {
    const match = getFolderNode(child, path);
    if (match) {
      return match;
    }
  }
  return null;
}

export function buildBreadcrumbs(selectedPath: string): Array<{ path: string; label: string }> {
  const parts = selectedPath ? selectedPath.split("/").filter(Boolean) : [];
  return parts.map((part, index) => ({
    path: parts.slice(0, index + 1).join("/"),
    label: part,
  }));
}

export function getVisibleFolderChildren(folder: FileNode | null, selectedExtension: string | null, sortKey: FileSortKey): FileNode[] {
  if (!folder || folder.kind !== "folder") {
    return [];
  }
  const children = folder.children.filter((child) => child.kind === "folder" || fileNodeMatches(child, selectedExtension));
  return sortNodes(children, sortKey);
}

export function buildSearchResults(
  root: FileNode | null,
  query: string,
  selectedExtension: string | null,
  sortKey: FileSortKey,
  limit: number,
): { items: FlatFileRecord[]; total: number } {
  if (!root || !query.trim()) {
    return { items: [], total: 0 };
  }
  const matchingFiles = sortFiles(flattenFileTree(root).filter((file) => fileMatches(file, query, selectedExtension)), sortKey);
  const maxItems = Math.max(0, limit);
  return {
    items: matchingFiles.slice(0, maxItems),
    total: matchingFiles.length,
  };
}
