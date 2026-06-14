"use client";

import { useEffect, useCallback } from "react";
import DocumentCard from "./DocumentCard";
import type { ColumnConfig } from "@/types/corpus";
import type { TeiSchema, CardViewConfig } from "@/types/schema";

export interface CardDisplayConfig {
  historicalIds: string[];
  extractedIds: string[];
  badgeFields: string[];
  badgeLabels: Record<string, Record<string, string>>;
}

interface DocumentModalProps {
  item: Record<string, string | string[]>;
  columnConfig: ColumnConfig[];
  cardConfig?: CardDisplayConfig | null;
  onClose: () => void;
  /** Engine-native schema (when available, CardView engine is used). */
  teiSchema?: TeiSchema;
  /** Engine-native card view config (when available, CardView engine is used). */
  cardViewConfig?: CardViewConfig;
  /** Badge labels for client-side badge rendering. */
  badgeLabels?: Record<string, Record<string, string>>;
}

export default function DocumentModal({ item, columnConfig, cardConfig, onClose, teiSchema, cardViewConfig, badgeLabels }: DocumentModalProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-lg border border-border bg-background p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-end">
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-2xl leading-none text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <DocumentCard
          item={item as Record<string, string | string[]> & { id: string }}
          columnConfig={columnConfig}
          cardConfig={cardConfig}
          badgeLabels={badgeLabels}
          teiSchema={teiSchema}
          cardViewConfig={cardViewConfig}
        />
      </div>
    </div>
  );
}
