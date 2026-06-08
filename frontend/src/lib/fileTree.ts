import type { FileNode } from "../types";

export interface FileTreeSelection {
  extension: string | null;
  folderCategory: string | null;
}

export function filterFileTree(node: FileNode, selection: FileTreeSelection): FileNode | null {
  return filterFileTreeRecursive(node, selection, false);
}

function filterFileTreeRecursive(
  node: FileNode,
  selection: FileTreeSelection,
  inMatchingFolderCategory: boolean,
): FileNode | null {
  const extensionSelected = selection.extension !== null;
  const categorySelected = selection.folderCategory !== null;

  if (!extensionSelected && !categorySelected) {
    return node;
  }

  if (node.kind === "file") {
    const extensionMatches = !extensionSelected || node.extension === selection.extension;
    const categoryAllowed = !categorySelected || inMatchingFolderCategory;
    return extensionMatches && categoryAllowed ? node : null;
  }

  const children = node.children
    .map((child) => filterFileTreeRecursive(child, selection, inMatchingFolderCategory || node.folder_category === selection.folderCategory))
    .filter((child): child is FileNode => child !== null);

  const categoryMatches = categorySelected && node.folder_category === selection.folderCategory;
  const shouldKeep = categorySelected ? categoryMatches || children.length > 0 : children.length > 0;

  if (!shouldKeep) {
    return null;
  }

  return {
    ...node,
    file_count: children.reduce((total, child) => total + countFilesInTree(child), 0),
    children,
  };
}

export function countFilesInTree(node: FileNode): number {
  if (node.kind === "file") {
    return 1;
  }
  return node.children.reduce((total, child) => total + countFilesInTree(child), 0);
}

export interface FlatFileRecord {
  name: string;
  path: string;
  displayName: string;
  extension: string;
  folderCategory: string | null;
  sizeBytes: number | null;
  modifiedAt: string | null;
  openUrl: string | null;
  downloadUrl: string | null;
}

export function flattenFileTree(node: FileNode): FlatFileRecord[] {
  if (node.kind === "file") {
    return [
      {
        name: node.name,
        path: node.relative_path || node.path,
        displayName: node.display_name || node.name,
        extension: node.extension ?? "",
        folderCategory: node.folder_category,
        sizeBytes: node.size_bytes,
        modifiedAt: node.modified_at,
        openUrl: node.open_url ?? null,
        downloadUrl: node.download_url ?? null,
      },
    ];
  }

  return node.children.flatMap((child) => flattenFileTree(child));
}
