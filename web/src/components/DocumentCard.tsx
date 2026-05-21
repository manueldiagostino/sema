"use client";

import { truncateWords } from "@/lib/truncateWords";

interface ColumnConfig {
  id: string;
  label: string;
}

interface DocumentCardProps {
  item: Record<string, string | string[]> & { id: string };
  columnConfig: ColumnConfig[];
  compact?: boolean;
  showRef?: boolean;
}

const longTextCols = ["price_clause", "penalty_clause"];

export default function DocumentCard({
  item,
  columnConfig,
  compact = false,
  showRef = false,
}: DocumentCardProps) {
  const title = (item.title as string) || "Document";

  const metadataCols = columnConfig.filter((c) => !longTextCols.includes(c.id));
  const longTextConfig = columnConfig.filter((c) => longTextCols.includes(c.id));

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-semibold text-primary">{title}</h2>
        {showRef && (
          <p className="mt-1 text-xs text-muted-foreground">Ref: {item.id}</p>
        )}
      </div>

      {/* Metadata grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {metadataCols.map((c) => {
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
      {longTextConfig.map((col) => {
        const val = item[col.id];
        const raw = Array.isArray(val) ? val.join(" ") : (val as string) || "—";
        const display = compact ? truncateWords(raw, 15) : raw;
        return (
          <div key={col.id} className="rounded border border-border bg-muted/30 p-4">
            <h3 className="mb-2 text-sm font-semibold text-primary">{col.label}</h3>
            <p className="text-sm leading-relaxed text-foreground text-justify">{display}</p>
          </div>
        );
      })}
    </div>
  );
}
