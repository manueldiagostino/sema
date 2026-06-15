"use client";

import React, { useMemo, useState, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  ColumnDef,
  SortingState,
  VisibilityState,
  RowSelectionState,
  OnChangeFn,
  flexRender,
  CellContext,
} from "@tanstack/react-table";
import type { TableViewConfig, TeiSchema, TableColumn } from "@/types/schema";
import type { CorpusItem } from "@/types/corpus";
import { truncateWords } from "@/lib/truncateWords";

// ── Props ────────────────────────────────────────────────────────────────────

export interface TableViewProps {
  /** Table view configuration (columns in display order). */
  config: TableViewConfig;
  /** Merged TEI schema (for element metadata). */
  schema: TeiSchema;
  /** Corpus data rows. */
  data: CorpusItem[];
  /** Optional: callback when a row is clicked (receives the item). */
  onRowClick?: (item: CorpusItem) => void;
  /** Charter types for charter type column rendering. */
  charterTypes?: { id: string; label: string }[];
  /** Optional: page sizes to offer. Defaults to [10, 25, 50, 100]. */
  pageSizes?: number[];
  /** External row selection state (controlled by parent). */
  rowSelection?: RowSelectionState;
  /** Called when row selection changes. */
  onRowSelectionChange?: (selection: RowSelectionState) => void;
  /** Render a custom toolbar above the table. Receives selected rows and total row count. */
  toolbar?: (props: { selectedRows: CorpusItem[]; rowCount: number }) => React.ReactNode;
  /** Render a custom footer below the pagination controls. */
  footer?: () => React.ReactNode;
  /** Badge labels map for client-side badge rendering (avoids fs dependency). */
  badgeLabels?: Record<string, Record<string, string>>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const PAGE_SIZES_DEFAULT = [10, 25, 50, 100];

/** Extract a 4-digit year from a dating string. */
function extractYear(dateStr: string): number | null {
  const match = dateStr.match(/\d{4}/);
  return match ? parseInt(match[0], 10) : null;
}

/** Evaluate a computed column formula against a row. */
function evaluateComputedFormula(
  formula: string,
  row: CorpusItem,
): string {
  // Formulas like "[repository] [shelfmark]" — replace [fieldId] with value
  return formula.replace(/\[([^\]]+)\]/g, (_, fieldId: string) => {
    const val = row[fieldId];
    if (val === undefined || val === null) return "";
    return Array.isArray(val) ? val.join(", ") : String(val);
  });
}

// ── Component ────────────────────────────────────────────────────────────────

export default function TableView({
  config,
  schema,
  data,
  onRowClick,
  charterTypes,
  pageSizes = PAGE_SIZES_DEFAULT,
  rowSelection,
  onRowSelectionChange,
  toolbar,
  footer,
  badgeLabels,
}: TableViewProps) {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  // Initialize column visibility from defaults
  const visibilityInitialized = useMemo(() => false, []);
  const [visInitDone, setVisInitDone] = useState(false);

  // Set initial visibility once
  React.useEffect(() => {
    if (!visInitDone && config.columns.length > 0) {
      const vis: VisibilityState = {};
      const defaultSet = new Set(config.defaultVisible ?? []);
      for (const col of config.columns) {
        vis[col.id] = config.defaultVisible ? defaultSet.has(col.id) : true;
      }
      setColumnVisibility(vis);
      setVisInitDone(true);
    }
  }, [config.columns, config.defaultVisible, visInitDone]);

  // Build columns from config
  const columns = useMemo<ColumnDef<CorpusItem>[]>(() => {
    const mapped: ColumnDef<CorpusItem>[] = config.columns.map((col) => {
      const render = col.render ?? "text";

      // Handle meta-columns that are not in schema.elements
      if (render === "id") {
        return {
          id: col.id,
          accessorFn: (row: CorpusItem) => row.id,
          header: col.label || "ID",
          enableSorting: col.sortable ?? true,
          enableHiding: false,
          meta: { minWidth: col.width ?? 140 },
          cell: ({ getValue }: CellContext<CorpusItem, unknown>) => (
            <span className="font-mono text-xs">{getValue() as string}</span>
          ),
        };
      }

      if (render === "charterType") {
        return {
          id: col.id,
          accessorFn: (row: CorpusItem) => {
            const lastUnderscore = row.id.lastIndexOf("_");
            const prefix = lastUnderscore >= 0 ? row.id.slice(0, lastUnderscore) : row.id;
            const ct = charterTypes?.find((c) => c.id === prefix);
            return ct?.label ?? row.id;
          },
          header: col.label || "Charter Type",
          enableSorting: col.sortable ?? true,
          enableHiding: false,
          meta: { minWidth: col.width ?? 220 },
          cell: ({ getValue }: CellContext<CorpusItem, unknown>) => (
            <span className="inline-flex items-center justify-center rounded-md bg-primary-container px-2.5 py-0.5 text-xs font-medium text-primary-on-container">
              {getValue() as string}
            </span>
          ),
        };
      }

      const elem = schema.elements[col.id];
      const sortable = col.sortable ?? true;
      const filterable = col.filterable ?? true;
      const join = elem?.join ?? ", ";
      const truncateWordsCount = col.truncate_words ?? elem?.truncate_words;
      const minWidth = col.width ?? (truncateWordsCount && truncateWordsCount > 0 ? 320 : 180);

      return {
        id: col.id,
        accessorKey: col.computed ? undefined : col.id,
        accessorFn: col.computed
          ? (row: CorpusItem) => {
              if (col.formula) {
                return evaluateComputedFormula(col.formula, row);
              }
              return "";
            }
          : undefined,
        header: elem?.label ?? col.id,
        enableSorting: sortable,
        enableColumnFilter: filterable,
        meta: { minWidth },
        cell: ({ getValue }: CellContext<CorpusItem, unknown>) => {
          const value = getValue() as string | string[] | undefined;

          // Handle computed columns (no accessorKey, value is computed by accessorFn)
          let display: string;
          if (col.computed) {
            display = (value as string) ?? "";
          } else if (Array.isArray(value)) {
            display = value.join(join);
          } else {
            display = (value as string) ?? "";
          }

          // Apply truncation
          const isLongText = truncateWordsCount && truncateWordsCount > 0;
          if (isLongText && typeof display === "string") {
            display = truncateWords(display, truncateWordsCount);
          }

          // Apply render style
          if (render === "badge") {
            // Badge rendering: split multi-values and render each as a badge pill
            const rawValues = Array.isArray(value)
              ? value
              : typeof value === "string" && value
                ? value.split(/\s+/)
                : [];
            const nonEmpty = rawValues.filter((v) => v !== "");
            // Only render known badge values (those with a label in badgeLabels)
            const badges = nonEmpty
              .map((v) => ({ value: v, label: badgeLabels?.[col.id]?.[v] }))
              .filter((b): b is { value: string; label: string } => b.label !== undefined);
            if (badges.length === 0) {
              return <span>—</span>;
            }
            return (
              <span className="flex flex-wrap gap-1">
                {badges.map((b, i) => (
                  <span
                    key={`${col.id}-${i}`}
                    className="inline-block rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent"
                  >
                    {b.label}
                  </span>
                ))}
              </span>
            );
          }

          if (render === "textarea") {
            return (
              <span className="text-justify block">{display}</span>
            );
          }

          // Default: text
          return (
            <span className={isLongText ? "text-justify block" : ""}>
              {display || "—"}
            </span>
          );
        },
      };
    });

    // Prepend a selection checkbox column when rowSelection is controlled externally
    if (rowSelection !== undefined && onRowSelectionChange) {
      const selectionColumn: ColumnDef<CorpusItem> = {
        id: "__selection__",
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllRowsSelected()}
            ref={(el) => {
              if (el) el.indeterminate = table.getIsSomeRowsSelected();
            }}
            onChange={() => table.toggleAllRowsSelected()}
            className="accent-accent"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={() => row.toggleSelected()}
            className="accent-accent"
          />
        ),
        size: 40,
        enableSorting: false,
        enableHiding: false,
      };
      const result: ColumnDef<CorpusItem>[] = [selectionColumn];
      // Insert actions column as second column (right after selection)
      if (onRowClick) {
        result.push({
          id: "__actions__",
          header: "",
          cell: ({ row }) => (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRowClick(row.original);
              }}
              className="rounded-md px-3 py-1.5 text-xs font-medium border border-accent/30 text-accent bg-background hover:bg-accent/10"
            >
              View
            </button>
          ),
          size: 80,
          enableSorting: false,
          enableHiding: false,
        });
      }
      result.push(...mapped);
      return result;
    }

    // Insert actions column as first column when onRowClick is provided (no selection mode)
    if (onRowClick) {
      return [
        {
          id: "__actions__",
          header: "",
          cell: ({ row }) => (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRowClick(row.original);
              }}
              className="rounded-md px-3 py-1.5 text-xs font-medium border border-accent/30 text-accent bg-background hover:bg-accent/10"
            >
              View
            </button>
          ),
          size: 80,
          enableSorting: false,
          enableHiding: false,
        },
        ...mapped,
      ];
    }

    return mapped;
  }, [config.columns, schema.elements, rowSelection, onRowSelectionChange, badgeLabels, onRowClick, charterTypes]);

  // Table instance
  const hasSelection = rowSelection !== undefined && onRowSelectionChange !== undefined;

  const table = useReactTable({
    data: data ?? [],
    columns,
    getRowId: (row) => row.id,
    state: {
      pagination,
      sorting,
      columnVisibility,
      ...(hasSelection ? { rowSelection } : {}),
    },
    onPaginationChange: setPagination,
    onSortingChange: setSorting as OnChangeFn<SortingState>,
    onColumnVisibilityChange: setColumnVisibility,
    ...(hasSelection
      ? { onRowSelectionChange: (updater) => {
          const next = typeof updater === "function" ? updater(rowSelection ?? {}) : updater;
          onRowSelectionChange(next);
        }}
      : {}),
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

  const totalColumnCount = columns.length;
  const defaultColIds = new Set(config.defaultVisible ?? config.columns.map((c) => c.id));

  // Derived selected rows for the toolbar render prop
  const selectedRows = useMemo(() => {
    if (!hasSelection || !rowSelection) return [];
    return data.filter((d) => rowSelection[d.id]);
  }, [data, rowSelection, hasSelection]);

  return (
    <div className="flex flex-col gap-4">
      {/* Column visibility menu */}
      <div className="flex justify-end">
        <div className="relative">
          <button
            onClick={() => setShowColumnMenu(!showColumnMenu)}
            className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
          >
            Columns ▼
          </button>
          {showColumnMenu && (() => {
            const visibleLeafColumns = table.getAllLeafColumns();
            const allVisible = visibleLeafColumns.every((c) => c.getIsVisible());
            const defaultColumns = visibleLeafColumns.filter((c) => defaultColIds.has(c.id));
            const otherColumns = visibleLeafColumns.filter((c) => !defaultColIds.has(c.id));
            return (
              <div className="absolute right-0 z-50 mt-2 w-52 rounded border border-border bg-background shadow-lg">
                <div className="border-b border-border">
                  <button
                    onClick={() => {
                      const defaults: VisibilityState = {};
                      for (const col of visibleLeafColumns) {
                        defaults[col.id] = defaultColIds.has(col.id);
                      }
                      setColumnVisibility(defaults);
                      setShowColumnMenu(false);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm text-accent hover:bg-muted font-medium"
                  >
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Reset to defaults
                  </button>
                </div>
                {defaultColumns.map((column) => {
                  const label = schema.elements[column.id]?.label ?? column.id;
                  return (
                    <label key={column.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted cursor-pointer">
                      <input
                        type="checkbox"
                        checked={column.getIsVisible()}
                        onChange={column.getToggleVisibilityHandler()}
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                  );
                })}
                <div className="border-t border-border" />
                <label className="flex items-center gap-2 px-3 py-2 hover:bg-muted cursor-pointer">
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
                  <span className="text-sm font-medium">Show all</span>
                </label>
                {otherColumns.map((column) => {
                  const label = schema.elements[column.id]?.label ?? column.id;
                  return (
                    <label key={column.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted cursor-pointer">
                      <input
                        type="checkbox"
                        checked={column.getIsVisible()}
                        onChange={column.getToggleVisibilityHandler()}
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Custom toolbar */}
      {toolbar && toolbar({ selectedRows, rowCount: filteredRowCount })}

      {/* Table */}
      <div className="flex-1 min-h-0">
        <div className="overflow-auto rounded-lg border border-border bg-background shadow-sm">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-border bg-muted">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left font-medium text-primary"
                      style={{ minWidth: (header.column.columnDef.meta as Record<string, unknown>)?.minWidth as number | undefined }}
                    >
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
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={totalColumnCount}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No results found.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => {
                      if (hasSelection) {
                        row.toggleSelected();
                      } else {
                        onRowClick?.(row.original);
                      }
                    }}
                    className={`border-b border-border transition-colors hover:bg-muted/50 ${
                      onRowClick && !hasSelection ? "cursor-pointer" : ""
                    } ${
                      hasSelection && row.getIsSelected() ? "bg-accent/25 shadow-[inset_4px_0_0_var(--color-accent)]" : ""
                    }`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-4 py-3 text-foreground"
                        style={{ minWidth: (cell.column.columnDef.meta as Record<string, unknown>)?.minWidth as number | undefined }}
                      >
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
            {pageSizes.map((size) => (
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

      {/* Custom footer */}
      {footer && footer()}
    </div>
  );
}
