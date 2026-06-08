"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import DeleteConfirmModal from "./DeleteConfirmModal";

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

/**
 * Derive the charter type from a document ID.
 * e.g. "instrumentum_venditionis_1318_01" -> "instrumentum_venditionis"
 */
function deriveCharterType(id: string): string {
  const parts = id.split("_");
  for (let i = 0; i < parts.length; i++) {
    if (/^\d+$/.test(parts[i])) {
      return parts.slice(0, i).join("_");
    }
  }
  return parts.length > 1 ? parts.slice(0, -1).join("_") : id;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

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

  const charterTypes = useMemo(() => {
    const types = new Set<string>();
    for (const item of items) {
      const id = String(item.id ?? "");
      if (id) types.add(deriveCharterType(id));
    }
    return Array.from(types).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    let result = items;

    if (typeFilter) {
      result = result.filter((item) => {
        const id = String(item.id ?? "");
        return deriveCharterType(id) === typeFilter;
      });
    }

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

    return result;
  }, [items, search, typeFilter]);

  function handleDeleted() {
    setDeleteTarget(null);
    setLoading(true);
    fetch("/api/corpus")
      .then((res) => res.json())
      .then((data: CorpusResponse) => {
        setItems(data.items);
      })
      .catch(() => {
        setError("Failed to refresh document list.");
      })
      .finally(() => setLoading(false));
  }

  // Loading state
  if (loading && items.length === 0) {
    return (
      <main className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
              <p className="mt-3 text-sm text-gray-500">Loading documents...</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Error state
  if (error && items.length === 0) {
    return (
      <main className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3" role="alert">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">
              {filteredItems.length} of {items.length} document{items.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/form"
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              + New Document
            </Link>
            <button
              type="button"
              onClick={() => {
                fetch("/api/admin/logout", { method: "POST" }).then(() => {
                  window.location.href = "/admin";
                });
              }}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-400"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents..."
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 pl-9 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <svg
              className="absolute left-3 top-2.5 h-4 w-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All charter types</option>
            {charterTypes.map((type) => (
              <option key={type} value={type}>
                {type.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        {filteredItems.length === 0 ? (
          <div className="rounded-md border border-gray-200 bg-white px-6 py-12 text-center">
            <p className="text-sm text-gray-500">
              {items.length === 0
                ? "No documents found. Create your first document."
                : "No documents match your search."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                  {DISPLAY_COLUMNS.map((col) => (
                    <th
                      key={col.id}
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                    >
                      {col.label}
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Type
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredItems.map((item, idx) => {
                  const docId = String(item.id ?? "");
                  const filename = docId + ".xml";
                  const charterType = deriveCharterType(docId);

                  return (
                    <tr key={docId || idx} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/form?edit=${encodeURIComponent(filename)}`}
                            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            Edit
                          </Link>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(filename)}
                            className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 focus:outline-none focus:ring-1 focus:ring-red-500"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                      {DISPLAY_COLUMNS.map((col) => (
                        <td
                          key={col.id}
                          className="whitespace-nowrap px-4 py-3 text-sm text-gray-900"
                          title={String(item[col.id] ?? "")}
                        >
                          {displayValue(item[col.id])}
                        </td>
                      ))}
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                          {charterType.replace(/_/g, " ")}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
