"use client";

interface ColumnConfig {
  id: string;
  label: string;
  truncateWords?: number;
}

interface DocumentCardProps {
  item: Record<string, string | string[]> & { id: string };
  columnConfig: ColumnConfig[];
  compact?: boolean;
  showRef?: boolean;
}

export default function DocumentCard({
  item,
  columnConfig,
  compact = false,
  showRef = false,
}: DocumentCardProps) {
  const title = (item.title as string) || "Document";

  const metadataCols = columnConfig.filter((c) => !c.truncateWords || c.truncateWords <= 0);
  const longTextConfig = columnConfig.filter((c) => c.truncateWords && c.truncateWords > 0);

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

      {/* Long text clauses — always show full content, never truncate */}
      {longTextConfig.map((col) => {
        const val = item[col.id];
        const text = Array.isArray(val) ? val.join(" ") : (val as string) || "—";
        return (
          <div key={col.id} className="rounded border border-border bg-muted/30 p-4">
            <h3 className="mb-2 text-sm font-semibold text-primary">{col.label}</h3>
            <pre
              className="text-sm leading-relaxed text-foreground font-sans"
              style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "break-word", margin: 0 }}
            >{text}</pre>
          </div>
        );
      })}
    </div>
  );
}
