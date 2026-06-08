"use client";

import { CorpusItem, CompareLayout } from "@/types/corpus";
import DocumentCard from "@/components/DocumentCard";

interface ColumnConfig {
  id: string;
  label: string;
  truncateWords?: number;
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
    <div className="h-full">
      {/* Stacked layout */}
      {layout === "stacked" && (
        <div className="space-y-6 overflow-auto h-full pr-2">
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

      {/* Side-by-side layout — per-section grid for aligned comparison */}
      {layout === "side-by-side" && (
        <div className="h-full overflow-auto rounded-lg border border-border">
          {/* Document title headers row */}
          <div className="flex mb-4">
            {documents.map((doc, docIdx) => (
              <div
                key={doc.id}
                className="w-[400px] flex-shrink-0 px-4 border-r border-border/25 last:border-r-0"
              >
                <h2 className="text-lg font-semibold text-primary">
                  {(doc.title as string) || "Document"}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">Ref: {doc.id}</p>
              </div>
            ))}
          </div>

          {/* Section rows — one row per columnConfig entry */}
          {columnConfig.map((col) => (
            <div key={col.id} className="flex mb-4 items-stretch">
              {documents.map((doc) => {
                const val = doc[col.id];
                const isLongText = col.truncateWords != null && col.truncateWords > 0;
                const raw = Array.isArray(val)
                  ? val.join(isLongText ? " " : ", ")
                  : (val as string) || "—";
                // Strip trailing ellipsis that may have leaked into the data
                const display = raw.replace(/…+$/, "");

                return (
                  <div
                    key={doc.id}
                    className="w-[400px] flex-shrink-0 px-4 border-r border-border/25 last:border-r-0"
                  >
                    <div className="rounded border border-border bg-muted/30 p-4 h-full overflow-visible">
                      <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                        {col.label}
                      </h3>
                      {isLongText ? (
                        <pre
                          className="text-sm leading-relaxed text-foreground font-sans"
                          style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "break-word", margin: 0 }}
                        >
                          {display}
                        </pre>
                      ) : (
                        <p className="text-sm text-foreground">{display}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}