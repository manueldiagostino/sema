"use client";

import { CorpusItem, CompareLayout } from "@/types/corpus";
import DocumentCard from "@/components/DocumentCard";

interface ColumnConfig {
  id: string;
  label: string;
}

interface CompareViewProps {
  documents: CorpusItem[];
  columnConfig: ColumnConfig[];
  layout: CompareLayout;
}

export default function CompareView({
  documents,
  columnConfig,
  layout,
}: CompareViewProps) {
  if (documents.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        No documents selected
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stacked layout */}
      {layout === "stacked" && (
        <div className="space-y-6">
          {documents.map((doc) => (
            <div key={doc.id} className="rounded-lg border border-border bg-card p-6">
              <DocumentCard
                item={doc}
                columnConfig={columnConfig}
                compact={false}
                showRef={true}
              />
            </div>
          ))}
        </div>
      )}

      {/* Side-by-side layout — horizontally scrollable, works with any number of docs */}
      {layout === "side-by-side" && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="min-w-[350px] max-w-[450px] flex-shrink-0 rounded-lg border border-border bg-card p-6"
            >
              <DocumentCard
                item={doc}
                columnConfig={columnConfig}
                compact={false}
                showRef={true}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}