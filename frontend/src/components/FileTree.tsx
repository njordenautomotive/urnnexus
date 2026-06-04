import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { formatBytes, formatDateTime } from "../lib/api";
import type { FileNode } from "../types";

interface FileTreeProps {
  tree: FileNode;
}

export function FileTree({ tree }: FileTreeProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => buildInitialExpanded(tree));

  useEffect(() => {
    setExpanded(buildInitialExpanded(tree));
  }, [tree]);

  return (
    <div className="file-tree" role="tree" aria-label="Prosjektfiler">
      {tree.children.map((child) => (
        <FileTreeNode
          key={child.path}
          node={child}
          depth={0}
          expanded={expanded}
          setExpanded={setExpanded}
        />
      ))}
    </div>
  );
}

function buildInitialExpanded(tree: FileNode): Record<string, boolean> {
  const state: Record<string, boolean> = {};
  for (const child of tree.children) {
    if (child.kind === "folder") {
      state[child.path] = true;
    }
  }
  return state;
}

function FileTreeNode({
  node,
  depth,
  expanded,
  setExpanded,
}: {
  node: FileNode;
  depth: number;
  expanded: Record<string, boolean>;
  setExpanded: Dispatch<SetStateAction<Record<string, boolean>>>;
}) {
  const isFolder = node.kind === "folder";
  const isOpen = isFolder ? expanded[node.path] ?? depth === 0 : false;

  const toggle = () => {
    if (!isFolder) {
      return;
    }
    setExpanded((current) => ({
      ...current,
      [node.path]: !isOpen,
    }));
  };

  return (
    <div className="file-tree__node" role="treeitem" aria-expanded={isFolder ? isOpen : undefined}>
      <button
        type="button"
        className={`file-tree__row file-tree__row--${isFolder ? "folder" : "file"}`}
        onClick={toggle}
        disabled={!isFolder}
        style={{ paddingLeft: `${depth * 1.05 + 0.85}rem` }}
      >
        <span className={`file-tree__icon file-tree__icon--${isFolder ? "folder" : "file"}`} aria-hidden="true" />
        <span className="file-tree__name">{node.name}</span>
        <span className="file-tree__meta">
          {isFolder ? `${node.file_count} filer` : node.extension ?? "fil"}
          {node.size_bytes !== null && node.size_bytes !== undefined ? ` · ${formatBytes(node.size_bytes)}` : ""}
          {node.modified_at ? ` · ${formatDateTime(node.modified_at)}` : ""}
        </span>
        {isFolder ? <span className="file-tree__toggle">{isOpen ? "▾" : "▸"}</span> : null}
      </button>
      {isFolder && isOpen && node.children.length > 0 ? (
        <div className="file-tree__children" role="group">
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              setExpanded={setExpanded}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
