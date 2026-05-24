"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

export interface GraphUrlState {
  view: "graph" | null;
  graphNode: string | null;
  graphTypes: string[] | null;
  graphDateFrom: string | null;
  graphDateTo: string | null;
  graphDocs: string | null;
}

export function useGraphUrlState(): {
  state: GraphUrlState;
  setState: (updates: {
    selectedNode?: string;
    visibleTypes?: string[];
    dateFrom?: string;
    dateTo?: string;
  }) => void;
  clearGraphParams: () => void;
} {
  const searchParams = useSearchParams();

  const state: GraphUrlState = useMemo(() => {
    const view = searchParams.get("view");
    const graphTypesRaw = searchParams.get("graphTypes");

    return {
      view: view === "graph" ? "graph" : null,
      graphNode: searchParams.get("graphNode"),
      graphTypes: graphTypesRaw
        ? graphTypesRaw.split(",").filter(Boolean)
        : null,
      graphDateFrom: searchParams.get("graphDateFrom"),
      graphDateTo: searchParams.get("graphDateTo"),
      graphDocs: searchParams.get("graphDocs"),
    };
  }, [searchParams]);

  const setState = (updates: {
    selectedNode?: string;
    visibleTypes?: string[];
    dateFrom?: string;
    dateTo?: string;
    docFilter?: string[];
  }) => {
    const params = new URLSearchParams(window.location.search);

    if (updates.selectedNode !== undefined) {
      if (updates.selectedNode) {
        params.set("graphNode", updates.selectedNode);
      } else {
        params.delete("graphNode");
      }
    }

    if (updates.visibleTypes !== undefined) {
      if (updates.visibleTypes.length > 0) {
        params.set("graphTypes", updates.visibleTypes.join(","));
      } else {
        params.delete("graphTypes");
      }
    }

    if (updates.dateFrom !== undefined) {
      if (updates.dateFrom) {
        params.set("graphDateFrom", updates.dateFrom);
      } else {
        params.delete("graphDateFrom");
      }
    }

    if (updates.dateTo !== undefined) {
      if (updates.dateTo) {
        params.set("graphDateTo", updates.dateTo);
      } else {
        params.delete("graphDateTo");
      }
    }

    if (updates.docFilter !== undefined) {
      if (updates.docFilter.length > 0) {
        params.set("graphDocs", updates.docFilter.join(","));
      } else {
        params.delete("graphDocs");
      }
    }

    // Ensure view=graph is set when updating graph state
    if (params.get("view") !== "graph") {
      params.set("view", "graph");
    }

    const queryString = params.toString();
    const newUrl = queryString
      ? `${window.location.pathname}?${queryString}`
      : window.location.pathname;

    window.history.replaceState({}, "", newUrl);
    // No popstate dispatch here — graph-internal state changes don't need a router re-render.
    // The EntityGraphView component manages its own state; replaceState just keeps the URL bar in sync.
  };

  const clearGraphParams = () => {
    const params = new URLSearchParams(window.location.search);
    params.delete("view");
    params.delete("graphNode");
    params.delete("graphTypes");
    params.delete("graphDateFrom");
    params.delete("graphDateTo");
    params.delete("graphDocs");

    const queryString = params.toString();
    const newUrl = queryString
      ? `${window.location.pathname}?${queryString}`
      : window.location.pathname;

    window.history.replaceState({}, "", newUrl);
    // popstate dispatch *is* needed here — changing the `view` param requires
    // Next.js Router to detect the change and swap between table and graph views.
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return { state, setState, clearGraphParams };
}
