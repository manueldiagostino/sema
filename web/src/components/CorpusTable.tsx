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
  truncate?: number;
}

const PAGE_SIZES = [10, 25, 50, 100];
const MAX_SELECTION = 20;

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
  const initialColumnFilters: { id: string; value: string }[] = [];
  for (const [key, value] of searchParams.entries()) {
    if (key.startsWith("filter_")) {
      initialColumnFilters.push({ id: key.replace("filter_", ""), value });
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

  // Fetch corpus-metadata.json once on mount
  useEffect(() => {
    fetch(`${window.location.pathname.replace(/\/$/, "")}/corpus-metadata.json`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Failed to load corpus metadata: ${res.status} ${res.statusText}`);
        }
        const json = await res.json();
        setColumnConfig(json.columns);
        setData(json.items);
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
  const [columnFilters, setColumnFilters] = useState<
    { id: string; value: unknown }[]
  >(initialColumnFilters);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<CorpusItem | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>(initialRowSelection);
  const [compareOpen, setCompareOpen] = useState(initialCompareOpen);
  const [compareFullscreen, setCompareFullscreen] = useState(initialCompareFullscreen);
  const columnMenuRef = useRef<HTMLDivElement>(null);

  // Sync URL with state changes (pagination, sorting, filters, compare)
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

    for (const filter of columnFilters) {
      if (filter.value) {
        params.set(`filter_${filter.id}`, filter.value as string);
      }
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
  }, [pagination, sorting, columnFilters, rowSelection, compareOpen, compareFullscreen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (columnMenuRef.current && !columnMenuRef.current.contains(event.target as Node)) {
        setShowColumnMenu(false);
      }
    }
    if (showColumnMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showColumnMenu]);

  // Auto-close drawer when selection drops below 2
  useEffect(() => {
    if (compareOpen && Object.keys(rowSelection).filter((k) => rowSelection[k]).length < 2) {
      setCompareOpen(false);
    }
  }, [compareOpen, rowSelection]);

  const columns = useMemo<ColumnDef<CorpusItem>[]>(() => {
    if (!columnConfig) return [];

    const selectionColumn: ColumnDef<CorpusItem> = {
      id: "select",
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllRowsSelected()}
          onChange={table.getToggleAllRowsSelectedHandler()}
          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
        />
      ),
      enableSorting: false,
      enableColumnFilter: false,
      meta: { minWidth: 40 },
    };

    const mappedColumns = columnConfig.map((col) => ({
      accessorKey: col.id,
      header: col.label,
      enableSorting: col.sortable,
      enableColumnFilter: col.filterable,
      meta: { minWidth: col.id === "price_clause" || col.id === "penalty_clause" ? 320 : 180 },
      cell: ({ getValue }: CellContext<CorpusItem, unknown>) => {
        const value = getValue() as string | string[];
        let display: string;
        if (Array.isArray(value)) {
          display = value.join(col.join);
        } else {
          display = value ?? "";
        }
        const isLongText = col.id === "price_clause" || col.id === "penalty_clause";
        if (isLongText && typeof display === "string") {
          display = truncateWords(display, 15);
        }
        return (
          <span className={isLongText ? "text-justify block" : ""}>
            {display}
          </span>
        );
      },
    }));

    return [
      selectionColumn,
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableColumnFilter: false,
        meta: { minWidth: 80 },
        cell: ({ row }: CellContext<CorpusItem, unknown>) => (
          <button
            onClick={() => setSelectedDocument(row.original)}
            className="rounded bg-primary px-2 py-1 text-xs text-white hover:bg-primary/90"
          >
            View
          </button>
        ),
      },
      ...mappedColumns,
    ];
  }, [columnConfig]);

  const table = useReactTable({
    data: data ?? [],
    columns,
    getRowId: (row) => row.id,
    state: {
      pagination,
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    onPaginationChange: setPagination,
    onSortingChange: setSorting as OnChangeFn<SortingState>,
    onColumnFiltersChange: setColumnFilters,
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
    setColumnFilters([]);
    setSorting([]);
    setPagination({ pageIndex: 0, pageSize: pagination.pageSize });
    window.history.replaceState({}, "", window.location.pathname);
  }, [pagination.pageSize]);

  const clearSelection = useCallback(() => {
    setRowSelection({});
    setCompareOpen(false);
  }, []);

  const handleCompare = useCallback(() => {
    setCompareOpen(true);
  }, []);

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

  // Total column count for colSpan (select + actions + mapped columns)
  const totalColumnCount = 2 + (columnConfig?.length ?? 0);

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-primary">Corpus</h1>
        <div className="flex items-center gap-2">
          {selectedCount > 0 && (
            <>
              <span className="text-sm text-muted">
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
          <button
            onClick={() => handleExport("csv")}
            className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
          >
            Export CSV
          </button>
          <button
            onClick={() => handleExport("json")}
            className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
          >
            Export JSON
          </button>
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
                (col) => col.id !== "actions" && col.id !== "select"
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

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border bg-muted">
                {headerGroup.headers.map((header) => {
                  const colConfig = columnConfig?.find(
                    (c) => c.id === header.column.id,
                  );
                  return (
                    <th key={header.id} className="px-4 py-3 text-left font-medium text-primary" style={{ minWidth: (header.column.columnDef.meta as any)?.minWidth }}>
                      <div className="flex flex-col gap-2">
                        {header.isPlaceholder ? null : (
                          <>
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
                            {colConfig?.filterable && (
                              <input
                                type="text"
                                placeholder={`Filter…`}
                                value={
                                  (header.column.getFilterValue() as string) ?? ""
                                }
                                onChange={(e) =>
                                  header.column.setFilterValue(e.target.value)
                                }
                                className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
                              />
                            )}
                          </>
                        )}
                      </div>
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
                  className={`border-b border-border transition-colors hover:bg-muted/50 ${
                    row.getIsSelected() ? "bg-primary/5" : ""
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

      {/* Pagination controls */}
      <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-2 text-sm text-muted">
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

        <div className="text-sm text-muted">
          Showing {startIdx} to {endIdx} of {filteredRowCount} results
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
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
