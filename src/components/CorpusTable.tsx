"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import type { CorpusItem, ColumnConfig, CardDisplayConfig } from "@/types/corpus";
import type { TeiSchema, TableViewConfig, CardViewConfig } from "@/types/schema";
import DocumentModal from "./DocumentModal";
import CompareDrawer from "./CompareDrawer";
import FacetSidebar from "./corpus/FacetSidebar";
import { Facets, CharterType } from "@/types/corpus";
import { useCorpusTableState } from "@/hooks/useCorpusTableState";
import { useCorpusFiltering } from "@/hooks/useCorpusFiltering";
import TableView from "./engine/TableView";

const PAGE_SIZES = [10, 25, 50, 100];

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function CorpusTable() {
  const {
    rowSelection, setRowSelection,
    selectedFacets, setSelectedFacets,
    dateRange, setDateRange,
    globalSearch, setGlobalSearch,
    priceFilter, setPriceFilter,
    compareOpen, setCompareOpen,
    compareFullscreen, setCompareFullscreen,
    resetKey,
    clearFilters,
    clearSelection,
  } = useCorpusTableState();

  const [data, setData] = useState<CorpusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Engine configs from JSON
  const [teiSchema, setTeiSchema] = useState<TeiSchema | null>(null);
  const [tableConfig, setTableConfig] = useState<TableViewConfig | null>(null);
  const [cardViewConfig, setCardViewConfig] = useState<CardViewConfig | null>(null);

  // Column config (legacy, still needed by DocumentModal / CompareDrawer)
  const [columnConfig, setColumnConfig] = useState<ColumnConfig[] | null>(null);

  // Card display config (still needed by DocumentModal)
  const [cardConfig, setCardConfig] = useState<CardDisplayConfig | null>(null);

  // Badge labels for client-side badge rendering
  const [badgeLabels, setBadgeLabels] = useState<Record<string, Record<string, string>>>({});

  // Facet sidebar state
  const [facets, setFacets] = useState<Facets>({});
  const [charterTypes, setCharterTypes] = useState<CharterType[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Export menu state
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Document modal state (opened via onRowClick on TableView rows)
  const [selectedDocument, setSelectedDocument] = useState<CorpusItem | null>(null);

  // Fetch corpus-metadata.json once on mount
  useEffect(() => {
    fetch("corpus-metadata.json")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Failed to load corpus metadata: ${res.status} ${res.statusText}`);
        }
        const json = await res.json();
        setColumnConfig(json.columns);
        setCardConfig(json.cardConfig ?? null);
        setBadgeLabels(json.badgeLabels ?? {});
        setTeiSchema(json.teiSchema ?? null);
        setTableConfig(json.tableConfigHome ?? null);
        setCardViewConfig(json.cardViewConfig ?? null);
        setData(json.items);
        setFacets(json.facets ?? {});
        setCharterTypes(json.charterTypes ?? []);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load corpus data");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const filteredData = useCorpusFiltering(
    data,
    globalSearch,
    selectedFacets,
    dateRange,
    priceFilter,
    charterTypes,
  );

  // Click-outside handler for export menu only
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    }
    if (showExportMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showExportMenu]);

  // Derived: selected documents for CompareDrawer and export
  const selectedDocuments = useMemo(() => {
    if (!data) return [];
    const selectedSet = new Set(Object.keys(rowSelection).filter((k) => rowSelection[k]));
    return data.filter((d) => selectedSet.has(d.id));
  }, [data, rowSelection]);

  // Selection counts for toolbar
  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k]);
  const selectedCount = selectedIds.length;

  const handleExport = useCallback(
    (format: "csv" | "json") => {
      const columnIds = tableConfig?.columns?.map((c) => c.id) ?? [];
      // If rows are selected, export only the selection; otherwise export all filtered rows
      const exportDocs = selectedCount > 0 ? selectedDocuments : filteredData;

      if (format === "csv") {
        // Dynamically import Papa for CSV generation
        import("papaparse").then((Papa) => {
          const csv = Papa.default.unparse(exportDocs, { columns: columnIds });
          downloadBlob(csv, "corpus-export.csv", "text/csv");
        });
      } else {
        const json = JSON.stringify(exportDocs, null, 2);
        downloadBlob(json, "corpus-export.json", "application/json");
      }
    },
    [filteredData, tableConfig, selectedCount, selectedDocuments],
  );

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* TOOLBAR: search + sidebar toggle */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-2">
          {/* Sidebar toggle button */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
          >
            {sidebarOpen ? "✕ Filters" : "☰ Filters"}
          </button>
          {/* Global search input */}
          <input
            type="text"
            value={globalSearch}
            onChange={(e) => {
              setGlobalSearch(e.target.value);
            }}
            placeholder="Search all fields…"
            className="w-64 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {/* MAIN CONTENT: sidebar + table in flex row */}
      <div className="flex" style={{ height: "calc(100vh - 180px)" }}>
        {/* FacetSidebar */}
        <FacetSidebar
          key={resetKey}
          facets={facets}
          charterTypes={charterTypes}
          selectedFacets={selectedFacets}
          dateRange={dateRange}
          onFacetChange={(facetId, values) => {
            setSelectedFacets((prev) => ({ ...prev, [facetId]: values }));
          }}
          onDateRangeChange={(range) => {
            setDateRange(range);
          }}
          onClearAll={clearFilters}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          priceFilter={priceFilter}
          onPriceFilterChange={(value) => {
            setPriceFilter(value);
          }}
        />

        {/* Table area — takes remaining space */}
        <div className="flex min-w-0 flex-1 flex-col">
          {loading ? (
            /* Loading state */
            <div className="flex-1 min-h-0">
              <div className="h-full overflow-auto rounded-lg border border-border bg-background shadow-sm">
                <div className="flex items-center justify-center py-16">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <svg
                      className="h-5 w-5 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Loading…
                  </div>
                </div>
              </div>
            </div>
          ) : tableConfig && teiSchema ? (
            <TableView
              key={resetKey}
              config={tableConfig}
              schema={teiSchema}
              data={filteredData}
              pageSizes={PAGE_SIZES}
              badgeLabels={badgeLabels}
              charterTypes={charterTypes}
              rowSelection={rowSelection}
              onRowSelectionChange={(newSelection) => {
                if (Object.keys(newSelection).length > 20) {
                  alert("Maximum 20 documents can be selected for comparison.");
                  return;
                }
                setRowSelection(newSelection);
              }}
              onRowClick={(item) => setSelectedDocument(item)}
              toolbar={({ selectedRows, rowCount }) => (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {selectedRows.length > 0 && (
                      <>
                        <span className="text-sm text-foreground">
                          {selectedRows.length} selected
                        </span>
                        <button
                          onClick={clearSelection}
                          className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
                        >
                          Clear selection
                        </button>
                      </>
                    )}
                    {selectedRows.length >= 2 && (
                      <button
                        onClick={() => setCompareOpen(true)}
                        className="rounded bg-primary px-3 py-1.5 text-sm text-white transition-colors hover:bg-primary/90"
                      >
                        Compare {selectedRows.length} selected →
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative" ref={exportMenuRef}>
                      <button
                        onClick={() => setShowExportMenu(!showExportMenu)}
                        className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
                      >
                        Export ▼
                      </button>
                      {showExportMenu && (
                        <div className="absolute right-0 z-50 mt-2 w-40 rounded border border-border bg-background shadow-lg">
                          <button
                            onClick={() => { handleExport("csv"); setShowExportMenu(false); }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                          >
                            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Export CSV
                          </button>
                          <button
                            onClick={() => { handleExport("json"); setShowExportMenu(false); }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                          >
                            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11v4m0 0l-2-2m2 2l2-2" />
                            </svg>
                            Export JSON
                          </button>
                        </div>
                      )}
                    </div>
                    {selectedRows.length > 0 && (
                      <button
                        onClick={() => {
                          const params = new URLSearchParams(window.location.search);
                          params.set("view", "graph");
                          const selectedDocIds = selectedRows.map((r) => r.id);
                          if (selectedDocIds.length > 0) {
                            params.set("graphNode", selectedDocIds[0]);
                            params.set("graphDocs", selectedDocIds.join(","));
                          }
                          window.history.pushState({}, "", `?${params.toString()}`);
                          window.dispatchEvent(new PopStateEvent("popstate"));
                        }}
                        className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
                      >
                        Graph View
                      </button>
                    )}
                    <button
                      onClick={clearFilters}
                      className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
                    >
                      Clear Filters
                    </button>
                  </div>
                </div>
              )}
            />
          ) : (
            /* No config available */
            <div className="flex-1 min-h-0">
              <div className="h-full overflow-auto rounded-lg border border-border bg-background shadow-sm">
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                  No table configuration available.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedDocument && (
        <DocumentModal
          item={selectedDocument}
          columnConfig={columnConfig ?? []}
          cardConfig={cardConfig}
          badgeLabels={badgeLabels}
          teiSchema={teiSchema ?? undefined}
          cardViewConfig={cardViewConfig ?? undefined}
          onClose={() => setSelectedDocument(null)}
        />
      )}

      <CompareDrawer
        documents={selectedDocuments}
        columnConfig={columnConfig ?? []}
        isOpen={compareOpen}
        isFullscreen={compareFullscreen}
        onClose={() => setCompareOpen(false)}
        onToggleFullscreen={() => setCompareFullscreen((prev) => !prev)}
      />
    </div>
  );
}
