"use client";

import { Fragment, useMemo } from "react";
import { CorpusItem, CompareLayout } from "@/types/corpus";
import type { TeiSchema, CardViewConfig, CardField, CardSection } from "@/types/schema";
import { FieldValue, hasValue, sectionIsEmpty } from "@/components/engine/CardView";

interface CompareViewProps {
  documents: CorpusItem[];
  layout: CompareLayout;
  /** Engine-native schema — required for full CardView rendering. */
  teiSchema?: TeiSchema;
  /** Engine-native card view config — required for section structure. */
  cardViewConfig?: CardViewConfig;
  /** Badge labels for client-side badge rendering. */
  badgeLabels?: Record<string, Record<string, string>>;
}

/** Get the label for a field from config or schema. */
function fieldLabel(field: CardField, schema?: TeiSchema): string {
  const label =
    field.label ?? schema?.elements[field.id]?.label ?? field.id;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Extract comparison sections from cardViewConfig. */
function getCompareSections(
  config: CardViewConfig | undefined | null,
): CardSection[] {
  if (!config) return [];
  const sections: CardSection[] = [];

  // Header sections
  if (config.header?.sections) {
    sections.push(...config.header.sections);
  }

  // Formulary sections from the first regular (non-special, non-always_visible) tab
  const regularTab = config.tabs?.items?.find(
    (t) => t.type !== "special" && t.type !== "always_visible",
  );
  if (regularTab?.sections) {
    sections.push(...regularTab.sections);
  }

  return sections;
}

/** Check if all documents have empty fields for a given section. */
function sectionEmptyAcrossDocs(
  docs: CorpusItem[],
  section: CardSection,
): boolean {
  return docs.every((doc) => sectionIsEmpty(doc, section));
}

// ── Stacked card: renders one document as a simplified comparison card ─────

function CompareCard({
  item,
  sections,
  schema,
  badgeLabels,
}: {
  item: CorpusItem;
  sections: CardSection[];
  schema?: TeiSchema;
  badgeLabels?: Record<string, Record<string, string>>;
}) {
  const title = (item.title as string) || "Document";

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      {/* Title + ref */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-primary">{title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Ref: {item.id}</p>
      </div>

      {/* Sections */}
      <div className="space-y-5">
        {sections.map((section) => {
          if (sectionIsEmpty(item, section)) return null;
          return (
            <div key={section.id}>
              <h3 className="text-sm font-semibold text-primary mb-2">
                {section.label}
              </h3>
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {section.fields.map((field) => {
                  if (!hasValue(item, field.id)) return null;
                  return (
                    <div key={field.id}>
                      <dt className="text-xs font-semibold text-muted-foreground">
                        {fieldLabel(field, schema)}
                      </dt>
                      <dd className="mt-0.5 text-sm text-foreground">
                        <FieldValue
                          item={item}
                          field={field}
                          schema={schema ?? ({} as TeiSchema)}
                          badgeLabels={badgeLabels}
                        />
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          );
        })}
      </div>

      {/* Empty state when no sections have data */}
      {sections.every((s) => sectionIsEmpty(item, s)) && (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No structured data available for this document.
        </p>
      )}
    </div>
  );
}

// ── Side-by-side grid: section-aligned comparison ──────────────────────────

function CompareGrid({
  documents,
  sections,
  schema,
  badgeLabels,
}: {
  documents: CorpusItem[];
  sections: CardSection[];
  schema?: TeiSchema;
  badgeLabels?: Record<string, Record<string, string>>;
}) {
  const docCount = documents.length;
  // Single flat grid: column 1 = field labels (auto), columns 2..N+1 = documents
  const gridCols = `auto repeat(${docCount}, minmax(280px, 1fr))`;
  // When 3+ docs, allow horizontal scroll
  const minWidth = docCount >= 3 ? `${docCount * 320}px` : "100%";

  // Pre-compute visible sections with their non-empty fields
  const visibleSectionData = useMemo(
    () =>
      sections
        .map((section) => ({
          section,
          fields: section.fields.filter((f) =>
            documents.some((doc) => hasValue(doc, f.id)),
          ),
        }))
        .filter((d) => d.fields.length > 0),
    [sections, documents],
  );

  return (
    <div
      className="h-full overflow-auto rounded-lg border border-border"
      style={{ minWidth }}
    >
      {visibleSectionData.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          No section data available for comparison.
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: gridCols }}>
          {/* ── Title row ── */}
          {/* Empty label column */}
          <div />
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="px-4 py-3 border-r border-border/25 last:border-r-0"
            >
              <h2 className="text-lg font-semibold text-primary">
                {(doc.title as string) || "Document"}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Ref: {doc.id}</p>
            </div>
          ))}

          {/* ── Sections: header spanning all columns, then field rows ── */}
          {visibleSectionData.map(({ section, fields }) => (
            <Fragment key={section.id}>
              {/* Section header spans all columns */}
              <div className="col-span-full border-t border-border bg-muted/20 px-4 py-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.label}
                </h3>
              </div>

              {/* Field rows: label in column 1, values in columns 2..N+1 */}
              {fields.map((field) => (
                <Fragment key={field.id}>
                  {/* Field label */}
                  <div className="px-4 py-3 border-r border-border/25 flex items-start">
                    <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                      {fieldLabel(field, schema)}
                    </span>
                  </div>

                  {/* Document value cells */}
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="px-4 py-3 border-r border-border/25 last:border-r-0 flex items-start"
                    >
                      {hasValue(doc, field.id) ? (
                        <FieldValue
                          item={doc}
                          field={field}
                          schema={schema ?? ({} as TeiSchema)}
                          badgeLabels={badgeLabels}
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </div>
                  ))}
                </Fragment>
              ))}
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function CompareView({
  documents,
  layout,
  teiSchema,
  cardViewConfig,
  badgeLabels,
}: CompareViewProps) {
  const sections = useMemo(
    () => getCompareSections(cardViewConfig),
    [cardViewConfig],
  );

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
            <CompareCard
              key={doc.id}
              item={doc}
              sections={sections}
              schema={teiSchema}
              badgeLabels={badgeLabels}
            />
          ))}
        </div>
      )}

      {/* Side-by-side layout */}
      {layout === "side-by-side" && (
        <CompareGrid
          documents={documents}
          sections={sections}
          schema={teiSchema}
          badgeLabels={badgeLabels}
        />
      )}
    </div>
  );
}
