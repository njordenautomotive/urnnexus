import { useEffect, useMemo, useRef, useState } from "react";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { StatusPill } from "../components/StatusPill";
import { createProjectFolder, formatBytes, formatDateTime, getProjectFiles, uploadProjectFile } from "../lib/api";
import { buildBreadcrumbs, buildSearchResults, getFolderNode, getVisibleFolderChildren, type FileSortKey } from "../lib/fileBrowser";
import type { FlatFileRecord } from "../lib/fileTree";
import { useResource } from "../lib/useResource";
import type { FileNode } from "../types";
import { useProjectPageContext } from "./ProjectPage";

function nodePath(node: FileNode): string {
  return node.relative_path || (node.path === "." ? "" : node.path);
}

function displayExtension(extension: string | null | undefined): string {
  const normalized = String(extension ?? "").replace(/^\./, "").toUpperCase();
  return normalized || "FIL";
}

export function ProjectFilesPage() {
  const { project, reloadProject } = useProjectPageContext();
  const { data: files, loading, error, reload } = useResource(() => getProjectFiles(project.projectName), [project.projectName]);
  const [selectedFolder, setSelectedFolder] = useState("");
  const [query, setQuery] = useState("");
  const [selectedExtension, setSelectedExtension] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<FileSortKey>("name");
  const [searchVisibleCount, setSearchVisibleCount] = useState(50);
  const [newFolderName, setNewFolderName] = useState("");
  const [operationMessage, setOperationMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSelectedFolder("");
    setQuery("");
    setSelectedExtension(null);
    setSortKey("name");
    setSearchVisibleCount(50);
    setOperationMessage(null);
  }, [project.projectName]);

  useEffect(() => {
    setSearchVisibleCount(50);
  }, [project.projectName, query, selectedExtension, sortKey]);

  const root = files?.file_tree ?? null;
  const currentFolder = useMemo(() => (root ? getFolderNode(root, selectedFolder) ?? root : null), [root, selectedFolder]);
  const folderOptions = useMemo(() => (root ? collectFolders(root) : []), [root]);
  const visibleChildren = useMemo(
    () => getVisibleFolderChildren(currentFolder, selectedExtension, sortKey),
    [currentFolder, selectedExtension, sortKey],
  );
  const searchResults = useMemo(
    () => buildSearchResults(root, query, selectedExtension, sortKey, searchVisibleCount),
    [root, query, selectedExtension, sortKey, searchVisibleCount],
  );

  async function refreshAll() {
    reload();
    reloadProject();
  }

  async function handleUpload(fileList: FileList | null) {
    const uploadFiles = Array.from(fileList ?? []);
    if (uploadFiles.length === 0) {
      return;
    }
    setOperationMessage(uploadFiles.length === 1 ? `Laster opp ${uploadFiles[0].name} ...` : `Laster opp ${uploadFiles.length} filer ...`);
    try {
      const responses = [];
      for (const file of uploadFiles) {
        responses.push(await uploadProjectFile(project.projectName, file, selectedFolder));
      }
      const warning = responses.find((response) => response.warning)?.warning;
      setOperationMessage(
        warning ?? `${responses.length.toLocaleString("nb-NO")} ${responses.length === 1 ? "fil" : "filer"} ble lastet opp i OneDrive. Kjør Synk OneDrive for å hente endringen inn i Nexus.`,
      );
      await refreshAll();
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : "Kunne ikke laste opp filen.");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) {
      return;
    }
    setOperationMessage(`Oppretter ${newFolderName} ...`);
    try {
      const response = await createProjectFolder(project.projectName, {
        folder_name: newFolderName,
        target_folder: selectedFolder,
      });
      setOperationMessage(response.warning ?? `${response.folder_name} ble opprettet i OneDrive. Kjør Synk OneDrive for å hente endringen inn i Nexus.`);
      setNewFolderName("");
      await refreshAll();
    } catch (error) {
      setOperationMessage(error instanceof Error ? error.message : "Kunne ikke opprette mappe.");
    }
  }

  if (loading) {
    return (
      <section className="surface surface--padded">
        <div className="loading-copy">Laster filstruktur ...</div>
      </section>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Kunne ikke laste filstrukturen"
        description={error}
        action={
          <button type="button" className="button button--secondary" onClick={reload}>
            Prøv igjen
          </button>
        }
      />
    );
  }

  if (!files || !root || !currentFolder) {
    return (
      <ErrorState
        title="Kunne ikke laste filstrukturen"
        description="API-et returnerte ikke filstrukturdata."
        action={
          <button type="button" className="button button--secondary" onClick={reload}>
            Prøv igjen
          </button>
        }
      />
    );
  }

  const searchQuery = query.trim();
  const folderTitle = selectedFolder ? selectedFolder.split("/").pop() || "Rot" : "Rot";
  const searchHasMore = searchResults.total > searchResults.items.length;

  return (
    <div className="section-stack">
      <section className="surface surface--padded">
        <div className="section-head">
          <div>
            <div className="section-kicker">Filer</div>
            <h2 className="section-title">Filutforsker for {project.displayName}</h2>
          </div>
          <div className="section-head__note">
            {project.fileCount.toLocaleString("nb-NO")} filer · {project.lastSyncedAt ? `synket ${formatDateTime(project.lastSyncedAt)}` : "synket ukjent"}
          </div>
        </div>

        <div className="detail-grid detail-grid--compact">
          <div className="detail-card">
            <span>Sti</span>
            <strong>{project.breadcrumbPath}</strong>
          </div>
          <div className="detail-card">
            <span>Status</span>
            <StatusPill status={project.status.level} />
          </div>
          <div className="detail-card">
            <span>Gjeldende mappe</span>
            <strong>{folderTitle}</strong>
          </div>
        </div>

        {project.hasCommentOnlyFiles ? (
          <div className="inline-note">Dette prosjektet har kommentardokumenter, men ingen kildefiler er synket fra OneDrive ennå.</div>
        ) : null}

        <div className="file-actions-bar">
          <button type="button" className="button" onClick={() => fileInputRef.current?.click()}>
            Last opp filer
          </button>
          <input ref={fileInputRef} type="file" hidden multiple onChange={(event) => void handleUpload(event.target.files)} />
          <label className="field field--inline">
            <span>Ny mappe</span>
            <input value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} placeholder="Mappenavn" />
          </label>
          <button type="button" className="button button--secondary" onClick={() => void handleCreateFolder()}>
            Opprett mappe
          </button>
          {operationMessage ? <div className="inline-note">{operationMessage}</div> : null}
        </div>

        <div className="file-toolbar">
          <label className="field">
            <span>Søk</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Søk i filnavn eller sti" />
          </label>
          <label className="field">
            <span>Filtype</span>
            <select value={selectedExtension ?? ""} onChange={(event) => setSelectedExtension(event.target.value || null)}>
              <option value="">Alle filtyper</option>
              {files.filters.extensions.map((facet) => (
                <option key={facet.value} value={facet.value}>
                  {facet.label} ({facet.count})
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Sortering</span>
            <select value={sortKey} onChange={(event) => setSortKey(event.target.value as FileSortKey)}>
              <option value="name">Navn A-Å</option>
              <option value="modified_desc">Sist endret nyest</option>
              <option value="modified_asc">Sist endret eldst</option>
              <option value="type">Filtype</option>
              <option value="size_desc">Størrelse størst</option>
              <option value="size_asc">Størrelse minst</option>
            </select>
          </label>
        </div>

        <div className="file-browser">
          <div className="folder-content-panel">
            <div className="file-results-head">
              <div>
                <div className="section-kicker">{searchQuery ? "Søkeresultater" : "Mappevisning"}</div>
                <h3 className="compact-title">{searchQuery ? "Alle treff i prosjektet" : selectedFolder ? selectedFolder : "Rot"}</h3>
              </div>
              <div className="section-head__note">
                {searchQuery ? `${searchResults.total.toLocaleString("nb-NO")} treff` : `${visibleChildren.length.toLocaleString("nb-NO")} direkte elementer`}
              </div>
            </div>

            <FolderBreadcrumb selectedPath={selectedFolder} onSelect={setSelectedFolder} />

            {searchQuery ? (
              <div className="section-stack">
                {searchResults.total > 0 ? (
                  <>
                    <SearchResultTable files={searchResults.items} />
                    {searchHasMore ? (
                      <div className="file-results-head">
                        <div className="section-head__note">
                          Viser {searchResults.items.length.toLocaleString("nb-NO")} av {searchResults.total.toLocaleString("nb-NO")} treff
                        </div>
                        <button type="button" className="button button--secondary" onClick={() => setSearchVisibleCount((value) => value + 50)}>
                          Vis flere treff
                        </button>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <EmptyState title="Ingen treff" description="Ingen filer matcher søket akkurat nå." />
                )}
              </div>
            ) : visibleChildren.length > 0 ? (
              <div className="file-list" role="list">
                {visibleChildren.map((child) =>
                  child.kind === "folder" ? (
                    <FolderRow key={nodePath(child)} folder={child} onOpen={() => setSelectedFolder(nodePath(child))} />
                  ) : (
                    <FileRow key={nodePath(child)} file={child} />
                  ),
                )}
              </div>
            ) : (
              <EmptyState title="Tom mappe" description="Denne mappen har ingen synlige filer eller undermapper." />
            )}
          </div>
        </div>

        <div className="file-folder-select">
          <label className="field">
            <span>Målmappe for upload</span>
            <select value={selectedFolder} onChange={(event) => setSelectedFolder(event.target.value)}>
              {folderOptions.map((folder) => (
                <option key={folder.path || "root"} value={folder.path}>
                  {folder.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
    </div>
  );
}

function FolderBreadcrumb({ selectedPath, onSelect }: { selectedPath: string; onSelect: (path: string) => void }) {
  const parts = buildBreadcrumbs(selectedPath);
  return (
    <div className="folder-breadcrumbs">
      <button type="button" onClick={() => onSelect("")}>
        Rot
      </button>
      {parts.map((part) => (
        <button key={part.path} type="button" onClick={() => onSelect(part.path)}>
          {part.label}
        </button>
      ))}
    </div>
  );
}

function FolderRow({ folder, onOpen }: { folder: FileNode; onOpen: () => void }) {
  return (
    <button type="button" className="file-browser-row file-browser-row--folder" onClick={onOpen}>
      <span className="file-tree__icon file-tree__icon--folder" aria-hidden="true" />
      <span className="file-browser-row__name">{folder.display_name || folder.name}</span>
      <span className="file-browser-row__meta">{folder.file_count.toLocaleString("nb-NO")} filer</span>
    </button>
  );
}

function FileRow({ file }: { file: FileNode }) {
  return (
    <div className="file-browser-row file-browser-row--file">
      <FileTypeIcon extension={file.extension} />
      <span className="file-browser-row__name">{file.display_name || file.name}</span>
      <span className="file-browser-row__meta">
        {formatBytes(file.size_bytes)} · {file.modified_at ? formatDateTime(file.modified_at) : "Ukjent dato"}
      </span>
      <span className="file-browser-row__actions">
        {file.open_url ? (
          <a className="button button--subtle" href={file.open_url} target="_blank" rel="noreferrer">
            Åpne
          </a>
        ) : null}
        {file.download_url ? (
          <a className="button button--subtle" href={file.download_url}>
            Last ned
          </a>
        ) : null}
      </span>
    </div>
  );
}

function SearchResultTable({ files }: { files: FlatFileRecord[] }) {
  if (files.length === 0) {
    return <EmptyState title="Ingen treff" description="Ingen filer matcher søket akkurat nå." />;
  }
  return (
    <div className="file-table-wrap">
      <table className="file-table">
        <thead>
          <tr>
            <th>Filnavn</th>
            <th>Type</th>
            <th>Størrelse</th>
            <th>Sist endret</th>
            <th>Handlinger</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr key={file.path}>
              <td>
                <div className="file-table__name">{file.displayName}</div>
                <div className="file-table__path">{file.path}</div>
              </td>
              <td>{displayExtension(file.extension)}</td>
              <td>{formatBytes(file.sizeBytes)}</td>
              <td>{file.modifiedAt ? formatDateTime(file.modifiedAt) : "—"}</td>
              <td>
                <div className="table-actions">
                  {file.openUrl ? (
                    <a className="button button--subtle" href={file.openUrl} target="_blank" rel="noreferrer">
                      Åpne
                    </a>
                  ) : null}
                  {file.downloadUrl ? (
                    <a className="button button--subtle" href={file.downloadUrl}>
                      Last ned
                    </a>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FileTypeIcon({ extension }: { extension: string | null | undefined }) {
  const label = displayExtension(extension);
  return <span className={`file-type-icon file-type-icon--${label.toLowerCase()}`}>{label}</span>;
}

function collectFolders(node: FileNode): Array<{ path: string; label: string }> {
  if (node.kind !== "folder") {
    return [];
  }
  const path = nodePath(node);
  return [
    { path, label: path || "Rot" },
    ...node.children.filter((child) => child.kind === "folder").flatMap((child) => collectFolders(child)),
  ];
}
