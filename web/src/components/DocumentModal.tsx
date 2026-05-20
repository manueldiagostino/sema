"use client";

import { useEffect, useCallback } from "react";

interface ColumnConfig {
  id: string;
  label: string;
}

interface DocumentModalProps {
  item: Record<string, string | string[]>;
  columnConfig: ColumnConfig[];
  onClose: () => void;
}

export default function DocumentModal({ item, columnConfig, onClose }: DocumentModalProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const title = (item.title as string) || "Document";
  const longTextCols = ["price_clause", "penalty_clause"];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-border bg-background p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-primary">{title}</h2>
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-2xl leading-none text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="space-y-6">
          {/* Metadata grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {columnConfig
              .filter((c) => !longTextCols.includes(c.id))
              .map((c) => {
                const val = item[c.id];
                const display = Array.isArray(val) ? val.join(", ") : (val as string) || "—";
                return (
                  <div key={c.id}>
                    <dt className="text-xs font-medium uppercase text-muted-foreground">{c.label}</dt>
                    <dd className="mt-1 text-sm text-foreground">{display}</dd>
                  </div>
                );
              })}
          </div>

          {/* Long text clauses */}
          {longTextCols.map((id) => {
            const col = columnConfig.find((c) => c.id === id);
            if (!col) return null;
            const val = item[id];
            const display = Array.isArray(val) ? val.join(" ") : (val as string) || "—";
            return (
              <div key={id} className="rounded border border-border bg-muted/30 p-4">
                <h3 className="mb-2 text-sm font-semibold text-primary">{col.label}</h3>
                <p className="text-sm leading-relaxed text-foreground text-justify">{display}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
