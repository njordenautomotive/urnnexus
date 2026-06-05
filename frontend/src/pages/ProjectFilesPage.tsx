import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { FileTree } from "../components/FileTree";
import { formatDateTime, getProjectFiles } from "../lib/api";
import { filterFileTree } from "../lib/fileTree";
import { displayProjectPath } from "../lib/projects";
import { useResource } from "../lib/useResource";
import type { CountFacet } from "../types";
import { useProjectPageContext } from "./ProjectPage";

interface FilterGroupProps {
  title: string;
  facets: CountFacet[];
  selected: string | null;
  onSelect: (value: string | null) => void;
  emptyLabel: string;
}

function FilterGroup({ title, facets, selected, onSelect, emptyLabel }: FilterGroupProps) {
  return (
    <section className="filter-group">
      <div className="filter-group__header">
        <div>
          <div className="filter-group__eyebrow">{title}</div>
          <div className="filter-group__title">{facets.length} valg</div>
        </div>
        {selected !== null ? (
          <button type="button" className="button button--subtle" onClick={() => onSelect(null)}>
            Tøm
          </button>
        ) : null}
      </div>
      {facets.length > 0 ? (
        <div className="chip-row">
          {facets.map((facet) => (
            <button
              key={facet.value}
              type="button"
              className={`chip ${selected === facet.value ? "chip--active" : ""}`}
              onClick={() => onSelect(selected === facet.value ? null : facet.value)}
            >
              <span>{facet.label}</span>
              <span className="chip__count">{facet.count}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-inline">{emptyLabel}</div>
      )}
    </section>
  );
}

export function ProjectFilesPage() {
  const { project } = useProjectPageContext();
  const { data: files, loading, error, reload } = useResource(() => getProjectFiles(project.project_name), [project.project_name]);
  const [selectedExtension, setSelectedExtension] = useState<string | null>(null);
  const [selectedFolderCategory, setSelectedFolderCategory] = useState<string | null>(null);

  useEffect(() => {
    setSelectedExtension(null);
    setSelectedFolderCategory(null);
  }, [project.project_name]);

  const filteredTree = useMemo(() => {
    if (!files) {
      return null;
    }
    return filterFileTree(files.file_tree, {
      extension: selectedExtension,
      folderCategory: selectedFolderCategory,
    });
  }, [files, selectedExtension, selectedFolderCategory]);

  if (loading) {
    return (
      <section className="surface surface--padded">
        <div className="loading-copy">Laster filstruktur …</div>
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

  if (!files) {
    return null;
  }

  const hasCommentOnlyFiles = files.total_files === 0 && files.comment_document_count > 0;

  return (
    <div className="section-stack">
      <section className="surface surface--padded">
        <div className="section-head">
          <div>
            <div className="section-kicker">Filer</div>
            <h2 className="section-title">Filstruktur for {project.display_name}</h2>
          </div>
          <div className="section-head__note">
            {files.total_files.toLocaleString("nb-NO")} filer · {files.source_label} ·{" "}
            {files.last_synced_at ? `synket ${formatDateTime(files.last_synced_at)}` : "synket ukjent"}
          </div>
        </div>

        <div className="detail-grid detail-grid--compact">
          <div className="detail-card">
            <span>Relativ sti</span>
            <strong>{displayProjectPath(files.relative_project_path)}</strong>
          </div>
          <div className="detail-card">
            <span>Siste kommentardokument</span>
            <strong>{files.latest_comment_document ?? "Ingen"}</strong>
          </div>
          <div className="detail-card">
            <span>Sist endret</span>
            <strong>{files.latest_comment_modified_at ? formatDateTime(files.latest_comment_modified_at) : "—"}</strong>
          </div>
        </div>

        {hasCommentOnlyFiles ? (
          <div className="inline-note">
            Dette prosjektet har bare kommentardokumenter i Kommentarer. Filstrukturen viser ingen kildefiler i lokal cache ennå.
          </div>
        ) : null}

        <div className="filters-grid">
          <FilterGroup
            title="Filtyper"
            facets={files.filters.extensions}
            selected={selectedExtension}
            onSelect={setSelectedExtension}
            emptyLabel="Ingen filtypefiltre er tilgjengelige."
          />
          <FilterGroup
            title="Mappetyper"
            facets={files.filters.folder_categories}
            selected={selectedFolderCategory}
            onSelect={setSelectedFolderCategory}
            emptyLabel="Ingen mappefiltre er tilgjengelige."
          />
        </div>

        {filteredTree ? <FileTree tree={filteredTree} /> : <EmptyState title="Ingen treff" description="Ingen filer matcher filtrene akkurat nå." />}
      </section>
    </div>
  );
}
