"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import CardView from "./engine/CardView";
import type { TeiSchema, CardViewConfig } from "@/types/schema";
import type { ColumnConfig } from "@/types/corpus";

export interface CardDisplayConfig {
  historicalIds: string[];
  extractedIds: string[];
  badgeFields: string[];
  badgeLabels: Record<string, Record<string, string>>;
}

interface DocumentCardProps {
  item: Record<string, string | string[]> & { id: string };
  columnConfig: ColumnConfig[];
  cardConfig?: CardDisplayConfig | null;
  compact?: boolean;
  showRef?: boolean;
  /** Engine-native schema (when available, CardView engine is used). */
  teiSchema?: TeiSchema;
  /** Engine-native card view config (when available, CardView engine is used). */
  cardViewConfig?: CardViewConfig;
  /** Badge labels for client-side badge rendering. */
  badgeLabels?: Record<string, Record<string, string>>;
}

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

export default function DocumentCard({
  item,
  columnConfig: _columnConfig,
  cardConfig: _cardConfig,
  compact = false,
  showRef = false,
  teiSchema,
  cardViewConfig,
  badgeLabels,
}: DocumentCardProps) {
  const [showDownload, setShowDownload] = useState(false);
  const downloadRef = useRef<HTMLDivElement>(null);
  const [xmlContent, setXmlContent] = useState<string | null>(null);
  const [xmlLoading, setXmlLoading] = useState(false);
  const [xmlError, setXmlError] = useState<string | null>(null);
  const xmlFetched = useRef(false);

  const title = (item.title as string) || "Document";
  const id = item.id;

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

  // Lazy-fetch XML when XML TEI tab is activated.
  // For static exports (GitHub Pages), fetch the pre-copied XML from /xml/.
  // In dev mode, fall back to the API route.
  const handleXmlTab = useCallback(() => {
    if (!xmlFetched.current) {
      xmlFetched.current = true;
      setXmlLoading(true);
      setXmlError(null);

      // Prefer static XML copy (available on static exports), fall back to API route
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
      const staticUrl = `${basePath}/xml/${encodeURIComponent(id)}.xml`;
      const apiUrl = `/api/admin/xml?filename=${encodeURIComponent(id)}.xml`;

      fetch(staticUrl)
        .then(async (res) => {
          if (!res.ok) throw new Error(`Static XML not available`);
          return res.text();
        })
        .catch(() => {
          // Fall back to API route
          return fetch(apiUrl).then(async (res) => {
            if (!res.ok)
              throw new Error(`Failed to load XML (${res.status})`);
            return res.text();
          });
        })
        .then((text) => {
          setXmlContent(text);
        })
        .catch((err) => {
          setXmlError(
            err instanceof Error ? err.message : "Failed to load XML",
          );
        })
        .finally(() => {
          setXmlLoading(false);
        });
    }
  }, [id]);

  const fullText = typeof item.full_text === "string" ? item.full_text : "";

  const handleDownloadTxt = useCallback(() => {
    if (fullText) {
      downloadBlob(fullText, `${id}_full_text.txt`, "text/plain");
    }
    setShowDownload(false);
  }, [fullText, id]);

  const handleDownloadXml = useCallback(() => {
    // Prefer static XML copy, fall back to API route for download
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    window.open(`${basePath}/xml/${encodeURIComponent(id)}.xml`, "_blank");
    setShowDownload(false);
  }, [id]);

  const handleDownloadPdf = useCallback(() => {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    window.open(`${basePath}/pdf/${encodeURIComponent(id)}_formulary.pdf`, "_blank");
    setShowDownload(false);
  }, [id]);

  const useEngine = Boolean(teiSchema && cardViewConfig);

  // Build the download menu ReactNode for CardView engine
  const downloadMenuNode = (
    <div className="relative" ref={downloadRef}>
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
    </div>
  );

  // ── Engine path: use CardView when schema configs are available ──
  if (useEngine) {
    return (
      <CardView
        config={cardViewConfig!}
        schema={teiSchema!}
        item={item}
        compact={compact}
        showRef={showRef}
        downloadMenu={downloadMenuNode}
        xmlContent={xmlContent}
        xmlLoading={xmlLoading}
        xmlError={xmlError}
        badgeLabels={badgeLabels}
        onTabChange={(tabId) => {
          if (tabId === "xml") handleXmlTab();
        }}
      />
    );
  }

  // ── Fallback path: minimal rendering when engine configs are not available ──
  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-semibold text-primary">{title}</h2>
        {showRef && (
          <p className="mt-1 text-xs text-muted-foreground">Ref: {id}</p>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Configuration not loaded.
      </p>

      {/* Download menu still available in fallback */}
      <div className="border-t border-border pt-4">
        {downloadMenuNode}
      </div>
    </div>
  );
}
