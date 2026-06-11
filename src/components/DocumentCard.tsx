"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import hljs from "highlight.js/lib/core";
import xml from "highlight.js/lib/languages/xml";

hljs.registerLanguage("xml", xml);

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

function PreliminaryInfo({
  item,
  metadataCols,
}: {
  item: Record<string, string | string[]> & { id: string };
  metadataCols: ColumnConfig[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {metadataCols.map((c) => {
        const val = item[c.id];
        const display = Array.isArray(val) ? val.join(", ") : (val as string) || "—";
        // Sentence-case label: capitalize first letter, rest lowercase
        const label = c.label.charAt(0).toUpperCase() + c.label.slice(1).toLowerCase();
        return (
          <div key={c.id}>
            <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-sm text-foreground">{display}</dd>
          </div>
        );
      })}
    </div>
  );
}

export default function DocumentCard({
  item,
  columnConfig,
  compact = false,
  showRef = false,
}: DocumentCardProps) {
  const [activeTab, setActiveTab] = useState<string>("formulary");
  const [showDownload, setShowDownload] = useState(false);
  const downloadRef = useRef<HTMLDivElement>(null);
  const [xmlContent, setXmlContent] = useState<string | null>(null);
  const [xmlLoading, setXmlLoading] = useState(false);
  const [xmlError, setXmlError] = useState<string | null>(null);
  const xmlFetched = useRef(false);

  const title = (item.title as string) || "Document";
  const id = item.id;

  const metadataCols = columnConfig.filter(
    (c) => (!c.truncateWords || c.truncateWords <= 0) && c.id !== "full_text"
  );
  const longTextConfig = columnConfig.filter((c) => c.truncateWords && c.truncateWords > 0);

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

  // Lazy-fetch XML when XML TEI tab is activated
  const handleXmlTab = useCallback(() => {
    setActiveTab("xml");
    if (!xmlFetched.current) {
      xmlFetched.current = true;
      setXmlLoading(true);
      setXmlError(null);
      fetch(`/api/admin/xml?filename=${encodeURIComponent(id)}.xml`)
        .then(async (res) => {
          if (!res.ok) throw new Error(`Failed to load XML (${res.status})`);
          const text = await res.text();
          setXmlContent(text);
        })
        .catch((err) => {
          setXmlError(err instanceof Error ? err.message : "Failed to load XML");
        })
        .finally(() => {
          setXmlLoading(false);
        });
    }
  }, [id]);

  const tabs = [
    { id: "fulltext", label: "Full Text", action: () => setActiveTab("fulltext") },
    { id: "formulary", label: "Formulary Analysis", action: () => setActiveTab("formulary") },
    { id: "xml", label: "XML TEI", action: handleXmlTab },
    { id: "photo", label: "Photographic Reproduction", action: () => setActiveTab("photo") },
  ];

  const fullText = typeof item.full_text === "string" ? item.full_text : "";

  const handleDownloadTxt = useCallback(() => {
    if (fullText) {
      downloadBlob(fullText, `${id}_full_text.txt`, "text/plain");
    }
    setShowDownload(false);
  }, [fullText, id]);

  const handleDownloadXml = useCallback(() => {
    // Direct browser navigation triggers download
    window.open(`/api/admin/xml?filename=${encodeURIComponent(id)}.xml`, "_blank");
    setShowDownload(false);
  }, [id]);

  const handleDownloadPdf = useCallback(() => {
    window.open(`/api/pdf/formulary?filename=${encodeURIComponent(id)}.xml`, "_blank");
    setShowDownload(false);
  }, [id]);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-semibold text-primary">{title}</h2>
        {showRef && (
          <p className="mt-1 text-xs text-muted-foreground">Ref: {id}</p>
        )}
      </div>

      {/* Preliminary info grid */}
      <PreliminaryInfo item={item} metadataCols={metadataCols} />

      {/* Tab bar + Download */}
      <div className="flex items-center justify-between border-b border-border">
        <div className="flex gap-0 -mb-px">
          {tabs.map((tab) => (
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
      </div>

      {/* Content panel */}
      <div className="min-h-[300px]">
        <div key={activeTab} className="animate-fade-in">
          {activeTab === "fulltext" && (
            <div className="max-h-[600px] min-h-[300px] overflow-y-auto rounded border border-border bg-muted/30 p-4">
              {fullText ? (
                <pre className="text-sm leading-relaxed text-foreground font-sans" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>
                  {fullText}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground">Full text not available.</p>
              )}
            </div>
          )}

          {activeTab === "formulary" && (
            <div className="min-h-[300px] space-y-4">
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
          )}

          {activeTab === "xml" && (
            <div className="max-h-[600px] min-h-[300px] overflow-y-auto rounded border border-border p-4">
              {xmlLoading && (
                <p className="text-sm text-muted-foreground">Loading XML…</p>
              )}
              {xmlError && (
                <p className="text-sm text-red-500">Error: {xmlError}</p>
              )}
              {xmlContent && !xmlLoading && !xmlError && (
                <pre className="text-xs leading-relaxed font-mono" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>
                  <code className="hljs" dangerouslySetInnerHTML={{ __html: hljs.highlight(xmlContent, { language: "xml" }).value }} />
                </pre>
              )}
            </div>
          )}

          {activeTab === "photo" && (
            <div className="min-h-[300px] rounded border border-border bg-muted/30 p-8 text-center flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Coming soon</p>
            </div>
          )}
        </div>
      </div>

      {/* Post-content sections */}
      <div className="space-y-4 border-t border-border pt-6">
        {["Edition", "Translations", "Physical Description", "Commentary", "Bibliography"].map((section) => (
          <div key={section}>
            <h3 className="text-sm font-semibold text-primary mb-1">{section}</h3>
            <p className="text-sm text-muted-foreground">—</p>
          </div>
        ))}
        <div>
          <h3 className="text-sm font-semibold text-primary mb-2">Citation & Editorial Status</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold text-muted-foreground">Editor</dt>
              <dd className="text-sm text-foreground">—</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-muted-foreground">Principal Contributor</dt>
              <dd className="text-sm text-foreground">—</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-muted-foreground">Contributors</dt>
              <dd className="text-sm text-foreground">—</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-muted-foreground">Last Revision</dt>
              <dd className="text-sm text-foreground">—</dd>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
