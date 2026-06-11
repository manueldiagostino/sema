"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  ColumnDef,
  SortingState,
  flexRender,
} from "@tanstack/react-table";
import DeleteConfirmModal from "./DeleteConfirmModal";
import PublishPanel from "./PublishPanel";
import FacetSidebar from "../corpus/FacetSidebar";
import type { Facets, CharterType, SelectedFacets, DateRange } from "@/types/corpus";

/** Shape of a single column config returned by /api/corpus */
interface ColumnConfig {
  id: string;
  label: string;
  xpath?: string;
  sortable?: boolean;
  filterable?: boolean;
  cardinality?: string;
  join?: string;
  truncateWords?: number;
}

/** Shape of the corpus API response */
interface CorpusResponse {
  columns: ColumnConfig[];
  items: Record<string, string | string[] | undefined>[];
  facets: Facets;
  charterTypes: CharterType[];
}

/** Columns to show in the dashboard table (by id) */
const DISPLAY_COLUMNS = [
  { id: "id", label: "Document" },
  { id: "author_name", label: "Author" },
  { id: "recipient_name", label: "Recipient" },
  { id: "dating_chronological", label: "Date" },
  { id: "repository", label: "Archive" },
  { id: "shelfmark", label: "Shelfmark" },
];

/** Derive the charter type ID from a document ID. e.g. "instrumentum_venditionis_1318_01" -> "instrumentum_venditionis" */
function deriveCharterType(id: string): string {
  const parts = id.split("_");
  for (let i = 0; i < parts.length; i++) {
    if (/^\d+$/.test(parts[i])) {
      return parts.slice(0, i).join("_");
    }
  }
  return parts.length > 1 ? parts.slice(0, -1).join("_") : id;
}

/** Extract a 4-digit year from a dating string (e.g. "1136 marzo 15" → 1136) */
function extractYear(dateStr: string): number | null {
  const match = dateStr.match(/\d{4}/);
  return match ? parseInt(match[0], 10) : null;
}

/** Truncate a string value for table display */
function displayValue(val: string | string[] | undefined): string {
  if (val === undefined || val === null) return "\u2014";
  if (Array.isArray(val)) {
    const joined = val.join("; ");
    return joined || "\u2014";
  }
  const str = String(val);
  if (str.length > 80) return str.slice(0, 77) + "...";
  return str || "\u2014";
}

export default function AdminDashboard() {
  const [items, setItems] = useState<Record<string, string | string[] | undefined>[]>([]);
  const [facets, setFacets] = useState<Facets>({});
  const [charterTypes, setCharterTypes] = useState<CharterType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Facet sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedFacets, setSelectedFacets] = useState<SelectedFacets>({});
  const [dateRange, setDateRange] = useState<DateRange>({ min: 0, max: 0 });
  const [resetKey, setResetKey] = useState(0);

  // Tanstack table state
  const [sorting, setSorting] = useState<SortingState>([]);

  useEffect(() => {
    let cancelled = false;

    async function fetchCorpus() {
      try {
        const res = await fetch("/api/corpus");
        if (!res.ok) {
          throw new Error(`Failed to load corpus (${res.status})`);
        }
        const data: CorpusResponse = await res.json();
        if (!cancelled) {
          setItems(data.items);
          setFacets(data.facets ?? {});
          setCharterTypes(data.charterTypes ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load documents.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchCorpus();
    return () => { cancelled = true; };
  }, []);

  /** Map a document ID to its charter type label using the corpus charterTypes */
  function getCharterTypeLabel(itemId: string): string | null {
    const prefix = deriveCharterType(itemId);
    const ct = charterTypes.find((c) => c.id === prefix);
    return ct?.label ?? null;
  }

  const filteredItems = useMemo(() => {
    let result = items;

    // Layer 1: Text search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((item) =>
        Object.values(item).some((val) => {
          if (val === undefined || val === null) return false;
          if (Array.isArray(val)) return val.some((v) => String(v).toLowerCase().includes(q));
          return String(val).toLowerCase().includes(q);
        }),
      );
    }

    // Layer 2: Facet filters (AND across groups, OR within each group)
    for (const [facetId, selectedValues] of Object.entries(selectedFacets)) {
      if (selectedValues.length === 0) continue;

      if (facetId === "charterType") {
        result = result.filter((item) => {
          const ctLabel = getCharterTypeLabel(String(item.id ?? ""));
          return ctLabel !== null && selectedValues.includes(ctLabel);
        });
      } else {
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

    // Layer 3: Date range filter
    const fromYear = dateRange.min || null;
    const toYear = dateRange.max || null;
    if (fromYear !== null || toYear !== null) {
      result = result.filter((item) => {
        const dateStr = item.dating_chronological;
        if (typeof dateStr !== "string" || !dateStr) return true;
        const year = extractYear(dateStr);
        if (year === null) return true;
        if (fromYear !== null && year < fromYear) return false;
        if (toYear !== null && year > toYear) return false;
        return true;
      });
    }

    return result;
  }, [items, search, selectedFacets, dateRange, charterTypes]);

  const columns = useMemo<ColumnDef<Record<string, string | string[] | undefined>>[]>(() => [
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/form?edit=${encodeURIComponent(String(row.original.id ?? "") + ".xml")}`}
            className="rounded-md border border-primary/30 bg-background px-3 py-1.5 text-xs font-medium text-primary hover:bg-accent/10"
          >
            Edit
          </Link>
          <button
            type="button"
            onClick={() => setDeleteTarget(String(row.original.id ?? "") + ".xml")}
            className="rounded-md border border-accent/40 bg-background px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent hover:text-white"
          >
            Delete
          </button>
        </div>
      ),
    },
    ...DISPLAY_COLUMNS.map((col) => ({
      accessorKey: col.id,
      header: col.label,
      cell: ({ getValue }: { getValue: () => unknown }) => displayValue(getValue() as string | string[] | undefined),
      enableSorting: true,
    })),
    {
      id: "charterType",
      header: "Type",
      enableSorting: true,
      cell: ({ row }) => {
        const docId = String(row.original.id ?? "");
        const charterType = deriveCharterType(docId);
        return (
          <span className="inline-flex items-center justify-center rounded-md bg-primary-container px-2.5 py-0.5 text-xs font-medium text-primary-on-container">
            {charterType.replace(/_/g, " ")}
          </span>
        );
      },
    },
  ], []);

  const table = useReactTable({
    data: filteredItems,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  function handleDeleted() {
    setDeleteTarget(null);
    setLoading(true);
    fetch("/api/corpus")
      .then((res) => res.json())
      .then((data: CorpusResponse) => {
        setItems(data.items);
        setFacets(data.facets ?? {});
        setCharterTypes(data.charterTypes ?? []);
      })
      .catch(() => {
        setError("Failed to refresh document list.");
      })
      .finally(() => setLoading(false));
  }

  // Loading state
  if (loading && items.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
          <p className="mt-3 text-sm text-muted-foreground">Loading documents...</p>
        </div>
      </main>
    );
  }

  // Error state
  if (error && items.length === 0) {
    return (
      <main className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-md border border-accent/30 bg-accent/10 px-4 py-3" role="alert">
            <p className="text-sm text-accent">{error}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border bg-background px-6 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-primary">Admin Dashboard</h1>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
          >
            {sidebarOpen ? "✕ Filters" : "☰ Filters"}
          </button>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="w-64 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
          />
          <span className="text-sm text-muted-foreground">
            {filteredItems.length} of {items.length} document{items.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/form"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2"
          >
            + New Document
          </Link>

        </div>
      </div>

      {/* Main content: sidebar + table */}
      <div className="flex flex-1 overflow-hidden">
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
          onClearAll={() => {
            setSelectedFacets({});
            setDateRange({ min: 0, max: 0 });
            setSearch("");
            setResetKey((k) => k + 1);
          }}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          priceFilter={null}
          onPriceFilterChange={() => {}}
        />

        {/* Table area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Error banner (non-fatal — shown when items exist but refresh fails) */}
          {error && (
            <div className="mx-4 mt-2 rounded-md border border-accent/30 bg-accent/10 px-4 py-2" role="alert">
              <p className="text-sm text-accent">{error}</p>
            </div>
          )}

          {filteredItems.length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  {items.length === 0
                    ? "No documents found. Create your first document."
                    : "No documents match your search or filters."}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto p-4">
              <div className="rounded-lg border border-border bg-background shadow-sm">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id} className="border-b border-border bg-muted">
                        {headerGroup.headers.map((header) => (
                          <th key={header.id} className="px-4 py-3 text-left font-medium text-primary">
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
                    {table.getRowModel().rows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-border transition-colors hover:bg-muted/50"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-4 py-3 text-sm text-foreground">
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Publish panel */}
      <div className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <PublishPanel />
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          filename={deleteTarget}
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleDeleted}
        />
      )}
    </main>
  );
}
