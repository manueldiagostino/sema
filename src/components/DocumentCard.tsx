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
    setActiveTab("xml");
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

  const tabs = [
    { id: "fulltext", label: "Full Text", action: () => setActiveTab("fulltext") },
    { id: "formulary", label: "Formulary Analysis", action: () => setActiveTab("formulary") },
    { id: "xml", label: "XML TEI", action: handleXmlTab },
    { id: "photo", label: "Photographic Reproduction", action: () => setActiveTab("photo") },
  ];

  const fullText = typeof item.full_text === "string" ? item.full_text : "";

  function getVal(colId: string): string {
    const v = item[colId];
    if (v === undefined || v === null) return "";
    if (Array.isArray(v)) return v.join("; ");
    return String(v);
  }

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
    // Prefer static PDF copy (available on static exports), fall back to API route
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    window.open(`${basePath}/pdf/${encodeURIComponent(id)}_formulary.pdf`, "_blank");
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
            <div className="min-h-[300px] space-y-6">
              {/* Section 1 — Protocol */}
              {(() => {
                const protocolFields: { label: string; id: string; badge?: string }[] = [
                  { label: "Invocatio", id: "invocatio", badge: "invocatio_type" },
                  { label: "Datatio Chronica", id: "datatio_chronica" },
                  { label: "Modern Date", id: "dating_chronological" },
                ];
                const visibleProtocol = protocolFields.filter((f) => getVal(f.id));
                if (visibleProtocol.length === 0) return null;
                return (
                  <div>
                    <h2 className="text-base font-semibold text-primary border-b border-border pb-2 mb-2">Protocol</h2>
                    <div className="space-y-4">
                      {visibleProtocol.map((f) => {
                        const badgeVal = f.badge ? getVal(f.badge) : "";
                        return (
                          <div key={f.id} className="rounded border border-border bg-muted/30 p-4">
                            <h3 className="mb-2 text-sm font-semibold text-primary">
                              {f.label}
                              {badgeVal && (
                                <span className="ml-2 rounded bg-accent/10 px-1.5 py-0.5 text-xs text-accent">{badgeVal}</span>
                              )}
                            </h3>
                            <pre className="text-sm leading-relaxed text-foreground font-sans" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>{getVal(f.id) || "—"}</pre>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Section 2 — Text */}
              {(() => {
                const textFieldDefs: { label: string; id: string; badge?: string }[] = [
                  { label: "Author", id: "author_context" },
                  { label: "Author (normalized)", id: "author_name" },
                  { label: "Verba Dispositiva", id: "verba_dispositiva" },
                  { label: "Recipient", id: "recipient_context" },
                  { label: "Recipient (normalized)", id: "recipient_name" },
                  { label: "Clausula Perpetuitatis", id: "clausula_perpetuitatis" },
                  { label: "Property / Assets", id: "property_description", badge: "property_type" },
                  { label: "Clausula Servitutis Passagii", id: "clausula_servitutis_passagii" },
                  { label: "Clausula Integritatis", id: "clausula_integritatis" },
                  { label: "Clausula Quietantiae Pretii", id: "clausula_quietantiae_pretii" },
                  { label: "Price", id: "pretium" },
                  { label: "Formula Confinium", id: "formula_confinium" },
                  { label: "Formula Mensurationum", id: "formula_mensurationum" },
                  { label: "Formula Transmissionis", id: "formula_transmissionis" },
                  { label: "Formula Libere Fruitionis", id: "formula_libere_fruitionis" },
                  { label: "Formula Legitimae Defensionis", id: "formula_legitimae_defensionis" },
                  { label: "Sanctio", id: "sanctio", badge: "sanctio_type" },
                  { label: "Property Location", id: "property_location" },
                ];
                const visibleText = textFieldDefs.filter((f) => getVal(f.id));
                if (visibleText.length === 0) return null;
                return (
                  <div>
                    <h2 className="text-base font-semibold text-primary border-b border-border pb-2 mb-2">Text</h2>
                    <div className="space-y-4">
                      {visibleText.map((f) => {
                        const badgeVal = f.badge ? getVal(f.badge) : "";
                        return (
                          <div key={f.id} className="rounded border border-border bg-muted/30 p-4">
                            <h3 className="mb-2 text-sm font-semibold text-primary">
                              {f.label}
                              {badgeVal && (
                                <span className="ml-2 rounded bg-accent/10 px-1.5 py-0.5 text-xs text-accent">{badgeVal}</span>
                              )}
                            </h3>
                            <pre className="text-sm leading-relaxed text-foreground font-sans" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>{getVal(f.id) || "—"}</pre>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Section 3 — Eschatocol */}
              {(() => {
                const eschatocolFields: { label: string; id: string; badge?: string }[] = [
                  { label: "Datatio Topica", id: "datatio_topica" },
                  { label: "Place of Redaction", id: "locus_redactionis" },
                  { label: "Subscriptiones Testium", id: "subscriptiones_testium" },
                  { label: "Subscriptio Emittentis", id: "subscriptio_emittentis", badge: "emittens_type" },
                  { label: "Testes", id: "testes_names" },
                  { label: "Completio", id: "completio" },
                  { label: "Notary", id: "notarius" },
                ];
                const visibleEschatocol = eschatocolFields.filter((f) => getVal(f.id));
                if (visibleEschatocol.length === 0) return null;
                return (
                  <div>
                    <h2 className="text-base font-semibold text-primary border-b border-border pb-2 mb-2">Eschatocol</h2>
                    <div className="space-y-4">
                      {visibleEschatocol.map((f) => {
                        const badgeVal = f.badge ? getVal(f.badge) : "";
                        return (
                          <div key={f.id} className="rounded border border-border bg-muted/30 p-4">
                            <h3 className="mb-2 text-sm font-semibold text-primary">
                              {f.label}
                              {badgeVal && (
                                <span className="ml-2 rounded bg-accent/10 px-1.5 py-0.5 text-xs text-accent">{badgeVal}</span>
                              )}
                            </h3>
                            <pre className="text-sm leading-relaxed text-foreground font-sans" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>{getVal(f.id) || "—"}</pre>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Empty state */}
              {(() => {
                const allIds = [
                  "invocatio", "invocatio_type", "datatio_chronica", "dating_chronological",
                  "author_context", "author_name", "verba_dispositiva", "recipient_context",
                  "recipient_name", "clausula_perpetuitatis", "property_description", "property_type",
                  "clausula_servitutis_passagii", "clausula_integritatis", "clausula_quietantiae_pretii",
                  "pretium", "formula_confinium", "formula_mensurationum", "formula_transmissionis",
                  "formula_libere_fruitionis", "formula_legitimae_defensionis", "sanctio", "sanctio_type",
                  "property_location", "datatio_topica", "locus_redactionis", "subscriptiones_testium",
                  "subscriptio_emittentis", "emittens_type", "testes_names", "completio", "notarius",
                ];
                const hasAny = allIds.some((id) => getVal(id));
                if (hasAny) return null;
                return (
                  <p className="text-sm text-muted-foreground text-center py-8">No formulary data available for this document.</p>
                );
              })()}
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
