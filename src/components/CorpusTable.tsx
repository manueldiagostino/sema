"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  ColumnDef,
  SortingState,
  VisibilityState,
  OnChangeFn,
  RowSelectionState,
  flexRender,
  CellContext,
} from "@tanstack/react-table";
import { CorpusItem } from "@/types/corpus";
import { truncateWords } from "@/lib/truncateWords";
import DocumentModal from "./DocumentModal";
import CompareDrawer from "./CompareDrawer";
import FacetSidebar from "./corpus/FacetSidebar";
import { Facets, CharterType, SelectedFacets, DateRange } from "@/types/corpus";

/**
 * Column configuration — loaded from corpus-metadata.json.
 */
interface ColumnConfig {
  id: string;
  label: string;
  xpath: string;
  sortable: boolean;
  filterable: boolean;
  cardinality: "single" | "multiple";
  join: string;
  truncateWords?: number;
}

const PAGE_SIZES = [10, 25, 50, 100];
const MAX_SELECTION = 20;

/** Metadata columns visible by default in the table (allowlist). Body-text clause columns are hidden. */
const DEFAULT_VISIBLE_COLUMNS = new Set([
  "author_name",
  "recipient_name",
  "dating_chronological",
  "dating_topical",
  "pretium",
  "property_location",
  "locus_redactionis",
  "notarius",
  "testes_names",
  "repository",
  "shelfmark",
]);

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
  const searchParams = useSearchParams();

  // Initialize state from URL query parameters
  const initialPageIndex = searchParams.get("page")
    ? parseInt(searchParams.get("page")!, 10)
    : 0;
  const initialPageSize = searchParams.get("pageSize")
    ? parseInt(searchParams.get("pageSize")!, 10)
    : 25;
  const initialSortField = searchParams.get("sortField");
  const initialSortOrder = searchParams.get("sortOrder");
  const initialSorting: SortingState =
    initialSortField
      ? [{ id: initialSortField, desc: initialSortOrder === "desc" }]
      : [];

  // Initialize facet state from URL
  const initialGlobalSearch = searchParams.get("search") ?? "";
  const initialDateRange: DateRange = {
    min: searchParams.get("dateFrom") ? parseInt(searchParams.get("dateFrom")!, 10) : 0,
    max: searchParams.get("dateTo") ? parseInt(searchParams.get("dateTo")!, 10) : 0,
  };
  const initialSelectedFacets: SelectedFacets = {};
  for (const [key, value] of searchParams.entries()) {
    if (key.startsWith("facet_")) {
      initialSelectedFacets[key.replace("facet_", "")] = value.split(",").filter(Boolean);
    }
  }

  // Initialize rowSelection from URL `compare` param
  const initialRowSelection: RowSelectionState = {};
  const compareIds = searchParams.get("compare");
  if (compareIds) {
    const ids = compareIds.split(",").filter(Boolean);
    for (const id of ids) {
      initialRowSelection[id] = true;
    }
  }

  // Initialize compareOpen/compareFullscreen from URL `view` param
  const initialView = searchParams.get("view");
  const initialCompareOpen = initialView === "compare";
  const initialCompareFullscreen = initialView === "compare";

  const [data, setData] = useState<CorpusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Column config loaded from JSON file
  const [columnConfig, setColumnConfig] = useState<ColumnConfig[] | null>(null);

  // Facet sidebar state
  const [facets, setFacets] = useState<Facets>({});
  const [charterTypes, setCharterTypes] = useState<CharterType[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedFacets, setSelectedFacets] = useState<SelectedFacets>(initialSelectedFacets);
  const [dateRange, setDateRange] = useState<DateRange>(initialDateRange);
  const [globalSearch, setGlobalSearch] = useState(initialGlobalSearch);
  const [priceFilter, setPriceFilter] = useState<boolean | null>(() => {
    const param = searchParams.get("price");
    if (param === "1") return true;
    if (param === "0") return false;
    return null;
  });
  const [resetKey, setResetKey] = useState(0);

  // Fetch corpus-metadata.json once on mount
  useEffect(() => {
    fetch("corpus-metadata.json")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Failed to load corpus metadata: ${res.status} ${res.statusText}`);
        }
        const json = await res.json();
        setColumnConfig(json.columns);
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

  const [pagination, setPagination] = useState({
    pageIndex: isNaN(initialPageIndex) ? 0 : initialPageIndex,
    pageSize: isNaN(initialPageSize) ? 25 : initialPageSize,
  });
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<CorpusItem | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>(initialRowSelection);
  const [compareOpen, setCompareOpen] = useState(initialCompareOpen);
  const [compareFullscreen, setCompareFullscreen] = useState(initialCompareFullscreen);
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const visibilityInitialized = useRef(false);

  // Sync URL with state changes (pagination, sorting, facets, compare)
  useEffect(() => {
    const params = new URLSearchParams();

    if (pagination.pageIndex !== 0) {
      params.set("page", String(pagination.pageIndex));
    }
    if (pagination.pageSize !== 25) {
      params.set("pageSize", String(pagination.pageSize));
    }

    if (sorting.length > 0) {
      params.set("sortField", sorting[0].id);
      params.set("sortOrder", sorting[0].desc ? "desc" : "asc");
    }

    // Sync facet selections to URL
    for (const [facetId, values] of Object.entries(selectedFacets)) {
      if (values.length > 0) {
        params.set(`facet_${facetId}`, values.join(","));
      }
    }

    // Sync date range to URL
    if (dateRange.min) {
      params.set("dateFrom", String(dateRange.min));
    }
    if (dateRange.max) {
      params.set("dateTo", String(dateRange.max));
    }

    // Sync global search to URL
    if (globalSearch) {
      params.set("search", globalSearch);
    }

    // Sync price filter to URL
    if (priceFilter !== null) {
      params.set("price", priceFilter ? "1" : "0");
    }

    // Sync compare param from rowSelection
    const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k]);
    if (selectedIds.length > 0) {
      params.set("compare", selectedIds.join(","));
    }

    // Sync view param for fullscreen compare
    if (compareOpen && compareFullscreen) {
      params.set("view", "compare");
    }

    const queryString = params.toString();
    const currentUrl = window.location.pathname + window.location.search;
    const newUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;

    if (currentUrl !== newUrl) {
      window.history.replaceState({}, "", newUrl);
    }
  }, [pagination, sorting, selectedFacets, dateRange, globalSearch, priceFilter, rowSelection, compareOpen, compareFullscreen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (columnMenuRef.current && !columnMenuRef.current.contains(event.target as Node)) {
        setShowColumnMenu(false);
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    }
    if (showColumnMenu || showExportMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showColumnMenu, showExportMenu]);

  // Set initial column visibility once when column config loads
  useEffect(() => {
    if (columnConfig && !visibilityInitialized.current) {
      const vis: VisibilityState = {};
      for (const col of columnConfig) {
        vis[col.id] = DEFAULT_VISIBLE_COLUMNS.has(col.id);
      }
      setColumnVisibility(vis);
      visibilityInitialized.current = true;
    }
  }, [columnConfig]);

  // Auto-close drawer when selection drops below 2
  useEffect(() => {
    if (compareOpen && Object.keys(rowSelection).filter((k) => rowSelection[k]).length < 2) {
      setCompareOpen(false);
    }
  }, [compareOpen, rowSelection]);

  /** Extract charter type label from a document ID */
  function getCharterTypeLabel(itemId: string, ctList: CharterType[]): string | null {
    const parts = itemId.split("_");
    const prefix = parts.length >= 3 ? parts.slice(0, -2).join("_") : itemId;
    const ct = ctList.find((c) => c.id === prefix);
    return ct?.label ?? null;
  }

  /** Extract a 4-digit year from a dating string (e.g. "1136 marzo 15" → 1136) */
  function extractYear(dateStr: string): number | null {
    const match = dateStr.match(/\d{4}/);
    return match ? parseInt(match[0], 10) : null;
  }

  const filteredData = useMemo(() => {
    if (!data) return [];
    let result = data;

    // Layer 1: Global search — case-insensitive substring across all string/string[] fields
    if (globalSearch.trim()) {
      const q = globalSearch.toLowerCase().trim();
      result = result.filter((item) => {
        return Object.values(item).some((val) => {
          if (val === null || val === undefined) return false;
          if (Array.isArray(val)) {
            return val.some((v) => typeof v === "string" && v.toLowerCase().includes(q));
          }
          if (typeof val === "string") {
            return val.toLowerCase().includes(q);
          }
          return false;
        });
      });
    }

    // Layer 2: Facet filters — AND across different facet groups, OR within each group
    for (const [facetId, selectedValues] of Object.entries(selectedFacets)) {
      if (selectedValues.length === 0) continue;

      if (facetId === "charterType") {
        // Charter type: filter by label derived from document ID prefix
        result = result.filter((item) => {
          const ctLabel = getCharterTypeLabel(item.id, charterTypes);
          return ctLabel !== null && selectedValues.includes(ctLabel);
        });
      } else {
        // Regular facet: match against item field value(s) — OR logic
        result = result.filter((item) => {
          const fieldValue = item[facetId];
          if (fieldValue === undefined || fieldValue === null) return false;
          if (Array.isArray(fieldValue)) {
            return fieldValue.some((v) => selectedValues.includes(v));
          }
          return selectedValues.includes(fieldValue as string);
        });
      }
    }

    // Layer 3: Date range filter on dating_chronological
    const fromYear = dateRange.min || null;
    const toYear = dateRange.max || null;
    if (fromYear !== null || toYear !== null) {
      result = result.filter((item) => {
        const dateStr = item.dating_chronological;
        if (typeof dateStr !== "string" || !dateStr) return true; // can't filter, include
        const year = extractYear(dateStr);
        if (year === null) return true; // no year found, include
        if (fromYear !== null && year < fromYear) return false;
        if (toYear !== null && year > toYear) return false;
        return true;
      });
    }

    // Layer 4: Price filter — show all, only with price, or only without price
    if (priceFilter !== null) {
      result = result.filter((item) => {
        const price = item.pretium;
        const hasPrice = typeof price === "string" && price.trim().length > 0;
        return priceFilter ? hasPrice : !hasPrice;
      });
    }

    return result;
  }, [data, globalSearch, selectedFacets, dateRange, priceFilter, charterTypes]);

  const columns = useMemo<ColumnDef<CorpusItem>[]>(() => {
    if (!columnConfig) return [];

    const charterTypeColumn: ColumnDef<CorpusItem> = {
      id: "charterType",
      header: "Charter Type",
      accessorFn: (row) => getCharterTypeLabel(row.id, charterTypes),
      enableSorting: true,
      enableColumnFilter: false,
      meta: { minWidth: 220 },
      cell: ({ getValue }: CellContext<CorpusItem, unknown>) => {
        const label = (getValue() as string) ?? "";
        return (
          <span className="inline-flex items-center justify-center rounded-md bg-primary-container px-2.5 py-0.5 text-xs font-medium text-primary-on-container">
            {label}
          </span>
        );
      },
    };

    const mappedColumns = columnConfig.map((col) => ({
      accessorKey: col.id,
      header: col.label,
      enableSorting: col.sortable,
      enableColumnFilter: col.filterable,
      meta: { minWidth: col.truncateWords && col.truncateWords > 0 ? 320 : 180 },
      cell: ({ getValue }: CellContext<CorpusItem, unknown>) => {
        const value = getValue() as string | string[];
        let display: string;
        if (Array.isArray(value)) {
          display = value.join(col.join);
        } else {
          display = value ?? "";
        }
        const isLongText = col.truncateWords && col.truncateWords > 0;
        if (isLongText && typeof display === "string") {
          display = truncateWords(display, col.truncateWords!);
        }
        return (
          <span className={isLongText ? "text-justify block" : ""}>
            {display}
          </span>
        );
      },
    }));

    return [
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableColumnFilter: false,
        meta: { minWidth: 80 },
        cell: ({ row }: CellContext<CorpusItem, unknown>) => (
          <button
            onClick={() => setSelectedDocument(row.original)}
            className="rounded-md px-3 py-1.5 text-xs font-medium border border-accent/30 text-accent bg-background hover:bg-accent/10"
          >
            View
          </button>
        ),
      },
      charterTypeColumn,
      ...mappedColumns,
    ];
  }, [columnConfig, charterTypes]);

  const table = useReactTable({
    data: filteredData ?? [],
    columns,
    getRowId: (row) => row.id,
    state: {
      pagination,
      sorting,
      columnVisibility,
      rowSelection,
    },
    onPaginationChange: setPagination,
    onSortingChange: setSorting as OnChangeFn<SortingState>,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: (updaterOrValue: RowSelectionState | ((old: RowSelectionState) => RowSelectionState)) => {
      const newSelection = typeof updaterOrValue === "function"
        ? updaterOrValue(rowSelection)
        : updaterOrValue;
      if (Object.keys(newSelection).length > MAX_SELECTION) {
        alert("Maximum 20 documents can be selected for comparison.");
        return;
      }
      setRowSelection(newSelection);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const filteredRowCount = table.getPrePaginationRowModel().rows.length;
  const startIdx = filteredRowCount === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const endIdx = Math.min(
    (pagination.pageIndex + 1) * pagination.pageSize,
    filteredRowCount,
  );

  const clearFilters = useCallback(() => {
    setSelectedFacets({});
    setDateRange({ min: 0, max: 0 });
    setGlobalSearch("");
    setPriceFilter(null);
    setSorting([]);
    setPagination({ pageIndex: 0, pageSize: pagination.pageSize });
    setResetKey((k) => k + 1);
    window.history.replaceState({}, "", window.location.pathname);
  }, [pagination.pageSize]);

  const clearSelection = useCallback(() => {
    setRowSelection({});
    setCompareOpen(false);
  }, []);

  const handleCompare = useCallback(() => {
    setCompareOpen(true);
  }, []);

  const handleGraphView = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("view", "graph");
    const selectedDocIds = Object.keys(rowSelection).filter((k) => rowSelection[k]);
    if (selectedDocIds.length > 0) {
      params.set("graphNode", selectedDocIds[0]);
      params.set("graphDocs", selectedDocIds.join(","));
    }
    window.history.pushState({}, "", `?${params.toString()}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, [rowSelection]);

  // Derived: selected documents for CompareDrawer and export
  const selectedDocuments = useMemo(() => {
    if (!data) return [];
    const selectedSet = new Set(Object.keys(rowSelection).filter((k) => rowSelection[k]));
    return data.filter((d) => selectedSet.has(d.id));
  }, [data, rowSelection]);

  // Selection counts for toolbar
  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k]);
  const selectedCount = selectedIds.length;
  const visibleSelectedCount = Object.keys(rowSelection).filter(
    (k) => rowSelection[k] && data?.some((d) => d.id === k)
  ).length;
  const hasFilteredOut = visibleSelectedCount < selectedCount;

  const handleExport = useCallback(
    (format: "csv" | "json") => {
      const columnIds = columnConfig?.map((c) => c.id) ?? [];
      // If rows are selected, export only the selection; otherwise export all filtered rows
      const exportDocs = selectedCount > 0
        ? selectedDocuments
        : table.getPrePaginationRowModel().rows.map((r) => r.original);

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
    [table, columnConfig, selectedCount, selectedDocuments],
  );

  // Total column count for colSpan (actions + charterType + mapped columns)
  const totalColumnCount = 2 + (columnConfig?.length ?? 0);

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* TOOLBAR: search + sidebar toggle + existing buttons */}
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
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
            placeholder="Search all fields…"
            className="w-64 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          {selectedCount > 0 && (
            <>
              <span className="text-sm text-foreground">
                {selectedCount} selected{hasFilteredOut ? ` · ${visibleSelectedCount} visible` : ""}
              </span>
              <button
                onClick={clearSelection}
                className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
              >
                Clear selection
              </button>
            </>
          )}
          {selectedCount >= 2 && (
            <button
              onClick={handleCompare}
              className="rounded bg-primary px-3 py-1.5 text-sm text-white transition-colors hover:bg-primary/90"
            >
              Compare {selectedCount} selected →
            </button>
          )}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
            >
              Export ▼
            </button>
            {showExportMenu && (
              <div className="absolute right-0 z-50 mt-2 w-36 rounded border border-border bg-background shadow-lg">
                <button
                  onClick={() => { handleExport("csv"); setShowExportMenu(false); }}
                  className="block w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                >
                  Export CSV
                </button>
                <button
                  onClick={() => { handleExport("json"); setShowExportMenu(false); }}
                  className="block w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                >
                  Export JSON
                </button>
              </div>
            )}
          </div>
          {selectedCount > 0 && (
            <button
              onClick={handleGraphView}
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
          <div className="relative" ref={columnMenuRef}>
            <button
              onClick={() => setShowColumnMenu(!showColumnMenu)}
              className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
            >
              Columns ▼
            </button>
            {showColumnMenu && (() => {
              const visibleLeafColumns = table.getAllLeafColumns().filter(
                (col) => col.id !== "actions" && col.id !== "charterType"
              );
              const allVisible = visibleLeafColumns.every((c) => c.getIsVisible());
              return (
                <div className="absolute right-0 z-50 mt-2 w-48 rounded border border-border bg-background shadow-lg">
                  <label className="flex items-center gap-2 border-b border-border px-3 py-2 hover:bg-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allVisible}
                      onChange={() => {
                        if (allVisible) {
                          visibleLeafColumns.forEach((c) => c.toggleVisibility(false));
                        } else {
                          visibleLeafColumns.forEach((c) => c.toggleVisibility(true));
                        }
                      }}
                    />
                    <span className="text-sm font-medium">All</span>
                  </label>
                  {visibleLeafColumns.map((column) => (
                    <label key={column.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted cursor-pointer">
                      <input
                        type="checkbox"
                        checked={column.getIsVisible()}
                        onChange={column.getToggleVisibilityHandler()}
                      />
                      <span className="text-sm">{columnConfig?.find((c) => c.id === column.id)?.label ?? column.id}</span>
                    </label>
                  ))}
                </div>
              );
            })()}
          </div>
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
            setPagination((prev) => ({ ...prev, pageIndex: 0 }));
          }}
          onDateRangeChange={(range) => {
            setDateRange(range);
            setPagination((prev) => ({ ...prev, pageIndex: 0 }));
          }}
          onClearAll={() => {
            setSelectedFacets({});
            setDateRange({ min: 0, max: 0 });
            setGlobalSearch("");
            setPriceFilter(null);
            setSorting([]);
            setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            setResetKey((k) => k + 1);
            window.history.replaceState({}, "", window.location.pathname);
          }}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          priceFilter={priceFilter}
          onPriceFilterChange={(value) => {
            setPriceFilter(value);
            setPagination((prev) => ({ ...prev, pageIndex: 0 }));
          }}
        />

        {/* Table area — takes remaining space */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Scrollable table wrapper */}
          <div className="flex-1 min-h-0">
            <div className="h-full overflow-auto rounded-lg border border-border bg-background shadow-sm">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id} className="border-b border-border bg-muted">
                      {headerGroup.headers.map((header) => {
                        return (
                          <th key={header.id} className="px-4 py-3 text-left font-medium text-primary" style={{ minWidth: (header.column.columnDef.meta as any)?.minWidth }}>
                              {header.isPlaceholder ? null : (
                                <button
                                  className="flex items-center gap-1 font-semibold hover:text-accent"
                                  onClick={header.column.getToggleSortingHandler()}
                                >
                                  {flexRender(
                                    header.column.columnDef.header,
                                    header.getContext(),
                                  )}
                                  {{
                                    asc: " ▲",
                                    desc: " ▼",
                                  }[header.column.getIsSorted() as string] ?? null}
                                </button>
                              )}
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={totalColumnCount}
                        className="px-4 py-8 text-center text-muted"
                      >
                        <div className="flex items-center justify-center gap-2">
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
                      </td>
                    </tr>
                  ) : table.getRowModel().rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={totalColumnCount}
                        className="px-4 py-8 text-center text-muted"
                      >
                        No results found.
                      </td>
                    </tr>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => row.toggleSelected()}
                        className={`border-b border-border transition-colors hover:bg-muted/50 cursor-pointer ${
                          row.getIsSelected() ? "bg-accent/25 shadow-[inset_4px_0_0_var(--color-accent)]" : ""
                        }`}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-4 py-3 text-foreground" style={{ minWidth: (cell.column.columnDef.meta as any)?.minWidth }}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination controls */}
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2 text-sm text-foreground/70">
              <span>Rows per page:</span>
              <select
                value={pagination.pageSize}
                onChange={(e) => {
                  table.setPageSize(Number(e.target.value));
                  table.setPageIndex(0);
                }}
                className="rounded border border-border bg-background px-2 py-1 text-foreground focus:border-accent focus:outline-none"
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-sm text-foreground/70">
              Showing {startIdx} to {endIdx} of {filteredRowCount} results
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => table.previousPage()}
                disabled={loading || !table.getCanPreviousPage()}
                className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => table.nextPage()}
                disabled={loading || !table.getCanNextPage()}
                className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {selectedDocument && (
        <DocumentModal
          item={selectedDocument}
          columnConfig={columnConfig ?? []}
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
