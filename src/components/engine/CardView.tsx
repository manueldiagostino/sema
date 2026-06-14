"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import hljs from "highlight.js/lib/core";
import xml from "highlight.js/lib/languages/xml";
import type {
  CardViewConfig,
  CardTab,
  CardSection,
  CardField,
  TeiSchema,
} from "@/types/schema";
import type { CorpusItem } from "@/types/corpus";
import { truncateWords } from "@/lib/truncateWords";

hljs.registerLanguage("xml", xml);

// ── Props ────────────────────────────────────────────────────────────────────

export interface CardViewProps {
  /** Card view configuration. */
  config: CardViewConfig;
  /** Merged TEI schema (for element metadata). */
  schema: TeiSchema;
  /** Document data row. */
  item: CorpusItem;
  /** Compact mode — smaller padding. */
  compact?: boolean;
  /** Show the document reference/ID below the title. */
  showRef?: boolean;

  /** When provided, renders this custom download menu INSTEAD of the built-in one.
      Placed in the same position (right side of tab bar). */
  downloadMenu?: React.ReactNode;

  /** External XML content for the XML tab. When provided, CardView uses this instead of fetching internally. */
  xmlContent?: string | null;
  /** Whether XML is currently loading externally. */
  xmlLoading?: boolean;
  /** XML fetch error message. */
  xmlError?: string | null;

  /** Called when the active tab changes. Parent can use this to trigger XML fetch. */
  onTabChange?: (tabId: string) => void;
  /** Badge labels map for client-side badge rendering (avoids fs dependency). */
  badgeLabels?: Record<string, Record<string, string>>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Get a string value from a CorpusItem field (array → joined, undefined → ""). */
function getVal(item: CorpusItem, colId: string): string {
  const v = item[colId];
  if (v === undefined || v === null) return "";
  if (Array.isArray(v)) return v.join("; ");
  return String(v);
}

/** Check if a field has a non-empty value. */
function hasValue(item: CorpusItem, fieldId: string): boolean {
  const v = item[fieldId];
  if (v === undefined || v === null) return false;
  if (Array.isArray(v)) return v.length > 0 && v.some((x) => x !== "");
  return String(v) !== "";
}

/** Check if all fields in a section are empty. */
function sectionIsEmpty(item: CorpusItem, section: CardSection): boolean {
  if (section.visibleWhen === "any") {
    // "any" means visible if at least one field has a value
    return !section.fields.some((f) => hasValue(item, f.id));
  }
  // "all" (default) means visible only if ALL fields have values
  return !section.fields.every((f) => hasValue(item, f.id));
}

// ── Sub-components ───────────────────────────────────────────────────────────

/** Renders a field value — plain text or badge based on render config. */
function FieldValue({
  item,
  field,
  schema,
  badgeLabels,
}: {
  item: CorpusItem;
  field: CardField;
  schema: TeiSchema;
  badgeLabels?: Record<string, Record<string, string>>;
}) {
  const fieldId = field.id;
  const render = field.render ?? "text";
  const rawValue = item[fieldId];

  if (rawValue === undefined || rawValue === null) {
    return <span>—</span>;
  }

  // Badge rendering
  if (render === "badge") {
    const values: string[] = typeof rawValue === "string"
      ? rawValue.split(/\s+/)
      : Array.isArray(rawValue)
        ? rawValue
        : [String(rawValue)];
    const nonEmpty = values.filter((v) => v !== "");
    // Only render known badge values (those with a label in badgeLabels)
    const badges = nonEmpty
      .map((v) => ({ value: v, label: badgeLabels?.[fieldId]?.[v] }))
      .filter((b): b is { value: string; label: string } => b.label !== undefined);
    if (badges.length === 0) return null;
    return (
      <span className="flex flex-wrap gap-1">
        {badges.map((b, i) => (
          <span
            key={`${fieldId}-${i}`}
            className="inline-block rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent"
          >
            {b.label}
          </span>
        ))}
      </span>
    );
  }

  // Default: plain text with optional truncation
  let display = Array.isArray(rawValue) ? rawValue.join("; ") : String(rawValue);
  const tw = field.truncate_words ?? schema.elements[fieldId]?.truncate_words;
  if (tw && tw > 0 && typeof display === "string") {
    display = truncateWords(display, tw);
  }
  return <span>{display || "—"}</span>;
}

/** Renders a card header section (Historical Info, Extracted Info). */
function HeaderSection({
  item,
  section,
  schema,
  badgeLabels,
}: {
  item: CorpusItem;
  section: CardSection;
  schema: TeiSchema;
  badgeLabels?: Record<string, Record<string, string>>;
}) {
  if (sectionIsEmpty(item, section)) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-primary mb-3">{section.label}</h3>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {section.fields.map((field) => {
          const label = (field.label ?? schema.elements[field.id]?.label ?? field.id);
          return (
            <div key={field.id}>
              <dt className="text-xs font-semibold text-muted-foreground">
                {label.charAt(0).toUpperCase() + label.slice(1)}
              </dt>
                <dd className="mt-1 text-sm text-foreground">
                  <FieldValue item={item} field={field} schema={schema} badgeLabels={badgeLabels} />
                </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

/** Renders the formulary sections within a tab. */
function FormularyTabContent({
  item,
  sections,
  schema,
}: {
  item: CorpusItem;
  sections: CardSection[];
  schema: TeiSchema;
}) {
  return (
    <div className="min-h-[300px] space-y-6">
      {sections.map((section) => {
        if (sectionIsEmpty(item, section)) return null;
        return (
          <div key={section.id}>
            <h2 className="text-base font-semibold text-primary border-b border-border pb-2 mb-2">
              {section.label}
            </h2>
            <div className="space-y-4">
              {section.fields.map((field) => {
                const val = getVal(item, field.id);
                if (!val) return null;
                const label = field.label ?? schema.elements[field.id]?.label ?? field.id;
                return (
                  <div key={field.id} className="rounded border border-border bg-muted/30 p-4">
                    <h3 className="mb-2 text-sm font-semibold text-primary">{label}</h3>
                    <pre
                      className="text-sm leading-relaxed text-foreground font-sans"
                      style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}
                    >
                      {val}
                    </pre>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function CardView({
  config,
  schema,
  item,
  compact = false,
  showRef = false,
  downloadMenu,
  xmlContent: xmlContentProp,
  xmlLoading: xmlLoadingProp,
  xmlError: xmlErrorProp,
  onTabChange,
  badgeLabels,
}: CardViewProps) {
  const [activeTab, setActiveTab] = useState<string>(() => {
    return config.tabs?.defaultTab ?? config.tabs?.items?.[0]?.id ?? "";
  });
  const [showDownload, setShowDownload] = useState(false);
  const downloadRef = useRef<HTMLDivElement>(null);
  const [internalXmlContent, setInternalXmlContent] = useState<string | null>(null);
  const [internalXmlLoading, setInternalXmlLoading] = useState(false);
  const [internalXmlError, setInternalXmlError] = useState<string | null>(null);
  const xmlFetched = useRef(false);

  // When external XML props are provided, use them; otherwise use internal state
  const useExternalXml = xmlContentProp !== undefined;
  const effectiveXmlContent = useExternalXml ? xmlContentProp : internalXmlContent;
  const effectiveXmlLoading = useExternalXml ? (xmlLoadingProp ?? false) : internalXmlLoading;
  const effectiveXmlError = useExternalXml ? xmlErrorProp : internalXmlError;

  const title = (item.title as string) ?? "Document";
  const id = item.id;
  const fullText = typeof item.full_text === "string" ? item.full_text : "";

  // Handle click outside download menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (downloadRef.current && !downloadRef.current.contains(event.target as Node)) {
        setShowDownload(false);
      }
    }
    if (showDownload) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDownload]);

  // Lazy-fetch XML when XML tab is activated (only when external XML is not provided)
  const handleXmlTab = useCallback(() => {
    setActiveTab("xml");
    onTabChange?.("xml");
    if (!useExternalXml && !xmlFetched.current) {
      xmlFetched.current = true;
      setInternalXmlLoading(true);
      setInternalXmlError(null);

      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
      const staticUrl = `${basePath}/xml/${encodeURIComponent(id)}.xml`;
      const apiUrl = `/api/admin/xml?filename=${encodeURIComponent(id)}.xml`;

      fetch(staticUrl)
        .then(async (res) => {
          if (!res.ok) throw new Error("Static XML not available");
          return res.text();
        })
        .catch(() => {
          return fetch(apiUrl).then(async (res) => {
            if (!res.ok) throw new Error(`Failed to load XML (${res.status})`);
            return res.text();
          });
        })
        .then((text) => {
          setInternalXmlContent(text);
        })
        .catch((err) => {
          setInternalXmlError(err instanceof Error ? err.message : "Failed to load XML");
        })
        .finally(() => {
          setInternalXmlLoading(false);
        });
    }
  }, [id, useExternalXml, onTabChange]);

  const handleDownloadTxt = useCallback(() => {
    if (fullText) {
      downloadBlob(fullText, `${id}_full_text.txt`, "text/plain");
    }
    setShowDownload(false);
  }, [fullText, id]);

  const handleDownloadXml = useCallback(() => {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    window.open(`${basePath}/xml/${encodeURIComponent(id)}.xml`, "_blank");
    setShowDownload(false);
  }, [id]);

  const handleDownloadPdf = useCallback(() => {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    window.open(`${basePath}/pdf/${encodeURIComponent(id)}_formulary.pdf`, "_blank");
    setShowDownload(false);
  }, [id]);

  // Split tabs into always_visible (header) and regular tabs
  const tabs = config.tabs?.items ?? [];
  const alwaysVisibleTabs = useMemo(
    () => tabs.filter((t) => t.type === "always_visible"),
    [tabs],
  );
  const regularTabs = useMemo(
    () => tabs.filter((t) => t.type !== "always_visible"),
    [tabs],
  );

  // The active tab data
  const activeTabData = useMemo(
    () => regularTabs.find((t) => t.id === activeTab) ?? regularTabs[0],
    [regularTabs, activeTab],
  );

  // Tab bar items (for non-always-visible, non-special regular tabs)
  const tabBarTabs = useMemo(
    () => regularTabs.filter((t) => t.type !== "special"),
    [regularTabs],
  );

  // Check if there's a fulltext special tab
  const hasFulltextTab = useMemo(
    () => regularTabs.some((t) => t.id === "fulltext" && t.type === "special"),
    [regularTabs],
  );
  const hasXmlTab = useMemo(
    () => regularTabs.some((t) => t.id === "xml" && t.type === "special"),
    [regularTabs],
  );
  const hasPhotoTab = useMemo(
    () => regularTabs.some((t) => t.id === "photo" && t.type === "special"),
    [regularTabs],
  );

  // Build the tab bar entries (include special tabs as well for the UI)
  const tabEntries = useMemo(() => {
    const entries: Array<{ id: string; label: string; action: () => void }> = [];
    for (const tab of tabBarTabs) {
      entries.push({
        id: tab.id,
        label: tab.label,
        action: () => {
          setActiveTab(tab.id);
          onTabChange?.(tab.id);
        },
      });
    }
    if (hasFulltextTab) {
      entries.push({
        id: "fulltext",
        label: "Full Text",
        action: () => {
          setActiveTab("fulltext");
          onTabChange?.("fulltext");
        },
      });
    }
    if (hasXmlTab) {
      entries.push({
        id: "xml",
        label: "XML TEI",
        action: handleXmlTab,
      });
    }
    if (hasPhotoTab) {
      entries.push({
        id: "photo",
        label: "Photographic Reproduction",
        action: () => {
          setActiveTab("photo");
          onTabChange?.("photo");
        },
      });
    }
    return entries;
  }, [tabBarTabs, hasFulltextTab, hasXmlTab, hasPhotoTab, handleXmlTab, onTabChange]);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-semibold text-primary">{title}</h2>
        {showRef && config.header?.showRef && (
          <p className="mt-1 text-xs text-muted-foreground">Ref: {id}</p>
        )}
      </div>

      {/* Header sections (always visible + always_visible tabs) */}
      <div className="space-y-4">
        {/* Explicit header sections from config */}
        {config.header?.sections?.map((section) => (
          <HeaderSection
            key={section.id}
            item={item}
            section={section}
            schema={schema}
            badgeLabels={badgeLabels}
          />
        ))}

        {/* Always-visible tabs rendered as header sections */}
        {alwaysVisibleTabs.map((tab) => {
          if (tab.sections && tab.sections.length > 0) {
            return (
              <div key={tab.id} className="space-y-4">
                {tab.sections.map((section) => (
                  <HeaderSection
                    key={section.id}
                    item={item}
                    section={section}
                    schema={schema}
                    badgeLabels={badgeLabels}
                  />
                ))}
              </div>
            );
          }
          if (tab.fields && tab.fields.length > 0) {
            // Flat field list — render as a simple grid
            return (
              <div key={tab.id}>
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {tab.fields.map((field) => {
                    const label = field.label ?? schema.elements[field.id]?.label ?? field.id;
                    return (
                      <div key={field.id}>
                        <dt className="text-xs font-semibold text-muted-foreground">
                          {label.charAt(0).toUpperCase() + label.slice(1)}
                        </dt>
                        <dd className="mt-1 text-sm text-foreground">
                          <FieldValue item={item} field={field} schema={schema} badgeLabels={badgeLabels} />
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
            );
          }
          return null;
        })}
      </div>

      {/* Tab bar + Download */}
      <div className="flex items-center justify-between border-b border-border">
        <div className="flex gap-0 -mb-px">
          {tabEntries.map((tab) => (
            <button
              key={tab.id}
              onClick={tab.action}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-accent text-accent"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative" ref={downloadRef}>
          {downloadMenu ?? (
            <>
              <button
                onClick={() => setShowDownload(!showDownload)}
                className="rounded-md border border-border p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Download"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                </svg>
              </button>
              {showDownload && (
                <div className="absolute right-0 z-50 mt-1 w-48 rounded border border-border bg-background shadow-lg">
                  <button
                    onClick={handleDownloadTxt}
                    disabled={!fullText}
                    className={`flex items-center gap-2 w-full px-3 py-2 text-left text-sm ${
                      fullText
                        ? "text-foreground hover:bg-muted"
                        : "text-muted-foreground cursor-not-allowed"
                    }`}
                  >
                    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    Full Text
                  </button>
                  <button
                    onClick={handleDownloadXml}
                    className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                  >
                    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    XML TEI
                  </button>
                  <button
                    onClick={handleDownloadPdf}
                    className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                  >
                    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 13l3 3 7-7" />
                    </svg>
                    Formulary Analysis
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Content panel */}
      <div className="min-h-[300px]">
        <div key={activeTab} className="animate-fade-in">
          {/* Full text tab */}
          {activeTab === "fulltext" && (
            <div className="max-h-[600px] min-h-[300px] overflow-y-auto rounded border border-border bg-muted/30 p-4">
              {fullText ? (
                <pre
                  className="text-sm leading-relaxed text-foreground font-sans"
                  style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}
                >
                  {fullText}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground">Full text not available.</p>
              )}
            </div>
          )}

          {/* XML tab */}
          {activeTab === "xml" && (
            <div className="max-h-[600px] min-h-[300px] overflow-y-auto rounded border border-border p-4">
              {effectiveXmlLoading && (
                <p className="text-sm text-muted-foreground">Loading XML…</p>
              )}
              {effectiveXmlError && (
                <p className="text-sm text-red-500">Error: {effectiveXmlError}</p>
              )}
              {effectiveXmlContent && !effectiveXmlLoading && !effectiveXmlError && (
                <pre
                  className="text-xs leading-relaxed font-mono"
                  style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}
                >
                  <code
                    className="hljs"
                    dangerouslySetInnerHTML={{
                      __html: hljs.highlight(effectiveXmlContent, { language: "xml" }).value,
                    }}
                  />
                </pre>
              )}
            </div>
          )}

          {/* Photo tab */}
          {activeTab === "photo" && (
            <div className="min-h-[300px] rounded border border-border bg-muted/30 p-8 text-center flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Coming soon</p>
            </div>
          )}

          {/* Regular tabs with sections */}
          {activeTabData && activeTab !== "fulltext" && activeTab !== "xml" && activeTab !== "photo" && (
            <FormularyTabContent
              item={item}
              sections={activeTabData.sections ?? []}
              schema={schema}
            />
          )}
        </div>
      </div>

      {/* Post-content sections */}
      {config.postContent && (
        <div className="space-y-4 border-t border-border pt-6">
          {config.postContent.sections?.map((section) => (
            <div key={section.id}>
              <h3 className="text-sm font-semibold text-primary mb-1">{section.label}</h3>
              <p className="text-sm text-muted-foreground">—</p>
            </div>
          ))}
          {config.postContent.citation && (
            <div>
              <h3 className="text-sm font-semibold text-primary mb-2">
                {config.postContent.citation.label}
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {config.postContent.citation.fields.map((field) => (
                  <div key={field.id}>
                    <dt className="text-xs font-semibold text-muted-foreground">{field.label}</dt>
                    <dd className="text-sm text-foreground">—</dd>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
