"use client";

import { useEffect, useState } from "react";
import { CorpusItem, CompareLayout } from "@/types/corpus";
import CompareView from "@/components/CompareView";

interface ColumnConfig {
  id: string;
  label: string;
}

interface CompareDrawerProps {
  documents: CorpusItem[];
  columnConfig: ColumnConfig[];
  isOpen: boolean;
  isFullscreen: boolean;
  onClose: () => void;
  onToggleFullscreen: () => void;
}

const STORAGE_KEY = "compare-layout";

function getInitialLayout(): CompareLayout {
  if (typeof window === "undefined") return "stacked";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "side-by-side" || stored === "stacked") return stored;
  return "stacked";
}

export default function CompareDrawer({
  documents,
  columnConfig,
  isOpen,
  isFullscreen,
  onClose,
  onToggleFullscreen,
}: CompareDrawerProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [layout, setLayout] = useState<CompareLayout>(getInitialLayout);

  // Persist layout preference
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, layout);
  }, [layout]);

  // Detect mobile viewport
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const forceFullscreen = isMobile || isFullscreen;
  const showLayoutToggle = documents.length >= 2 && !isMobile;

  return (
    <>
      {/* Backdrop — hidden in fullscreen mode */}
      {!forceFullscreen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer panel */}
      <div
        className={`fixed top-0 right-0 z-50 flex flex-col bg-background shadow-xl transition-transform duration-300 ease-in-out ${
          forceFullscreen
            ? "w-full h-full translate-x-0"
            : "w-[65vw] h-full translate-x-0"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Document comparison"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
          <h2 className="text-sm font-semibold text-foreground">
            Comparing {documents.length} document{documents.length !== 1 ? "s" : ""}
          </h2>
          <div className="flex items-center gap-2">
            {/* Layout toggle — always visible with ≥2 docs (desktop only) */}
            {showLayoutToggle && (
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setLayout("stacked")}
                  className={`rounded border px-2 py-1 text-xs transition-colors ${
                    layout === "stacked"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted/50"
                  }`}
                  aria-pressed={layout === "stacked"}
                >
                  ☰ Stacked
                </button>
                <button
                  type="button"
                  onClick={() => setLayout("side-by-side")}
                  className={`rounded border px-2 py-1 text-xs transition-colors ${
                    layout === "side-by-side"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted/50"
                  }`}
                  aria-pressed={layout === "side-by-side"}
                >
                  ⊞ Side by side
                </button>
              </div>
            )}
            {/* Expand/collapse — hidden on mobile */}
            {!isMobile && (
              <button
                type="button"
                onClick={onToggleFullscreen}
                className="rounded border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                aria-label={isFullscreen ? "Collapse" : "Expand to fullscreen"}
                title={isFullscreen ? "Collapse" : "Expand to fullscreen"}
              >
                {isFullscreen ? "⤡" : "⤢"}
              </button>
            )}
            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              aria-label="Close comparison"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-4">
          <CompareView
            documents={documents}
            columnConfig={columnConfig}
            layout={layout}
          />
        </div>
      </div>
    </>
  );
}
