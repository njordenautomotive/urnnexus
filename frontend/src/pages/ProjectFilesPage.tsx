import { useEffect, useState } from "react";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { FileTree } from "../components/FileTree";
import { StatCard } from "../components/StatCard";
import { formatDateTime, getProjectFiles } from "../lib/api";
import { countFilesInTree, filterFileTree } from "../lib/fileTree";
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
        <div className="filter-group__title">{title}</div>
        <button type="button" className="button button--ghost" onClick={() => onSelect(null)} disabled={selected === null && facets.length > 0}>
          Alle
        </button>
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

function countVisibleFiles(node: ReturnType<typeof filterFileTree>): number {
  if (node === null) {
    return 0;
  }
  return countFilesInTree(node);
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

  if (loading) {
    return <section className="surface surface--padded">Laster filstruktur …</section>;
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

  const filteredTree = filterFileTree(files.file_tree, {
    extension: selectedExtension,
    folderCategory: selectedFolderCategory,
  });
  const visibleCount = countVisibleFiles(filteredTree);
  const extensionLabel = selectedExtension ?? "alle filtyper";
  const categoryLabel = selectedFolderCategory ?? "alle mapper";

  return (
    <div className="section-stack">
      <section className="surface surface--padded">
        <div className="section-header">
          <div>
            <div className="section-kicker">Filstruktur</div>
            <h2 className="section-title">Prosjektfiler</h2>
          </div>
          <div className="section-meta">
            <StatCard label="Totalt" value={files.total_files.toLocaleString("nb-NO")} note={project.project_name} tone="accent" />
          </div>
        </div>

        <div className="info-grid">
          <div className="info-card">
            <div className="info-card__label">Prosjektsti</div>
            <div className="code-block code-block--compact">{files.project_path}</div>
          </div>
          <div className="info-card">
            <div className="info-card__label">Filtre</div>
            <div className="info-card__note">
              {extensionLabel} · {categoryLabel}
            </div>
            <div className="info-card__note">Viser {visibleCount.toLocaleString("nb-NO")} filer i den filtrerte visningen</div>
          </div>
        </div>

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

        {filteredTree ? (
          <div className="tree-panel">
            <FileTree tree={filteredTree} />
          </div>
        ) : (
          <EmptyState title="Ingen treff" description="Ingen filer matcher filtrene du har valgt." />
        )}
      </section>

      <section className="surface surface--padded">
        <div className="section-header">
          <div>
            <div className="section-kicker">Metadata</div>
            <h2 className="section-title">Appliance-data</h2>
          </div>
        </div>
        <dl className="definition-grid">
          <div className="definition-item">
            <dt>Oppdatering</dt>
            <dd>{formatDateTime(files.file_tree.modified_at)}</dd>
          </div>
          <div className="definition-item">
            <dt>Advarsler</dt>
            <dd>{files.warnings.length}</dd>
          </div>
          <div className="definition-item definition-item--wide">
            <dt>Filtre på backend</dt>
            <dd className="code-block code-block--compact">
              {files.filters.extensions.length > 0 || files.filters.folder_categories.length > 0
                ? "Ja"
                : "Nei"}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
