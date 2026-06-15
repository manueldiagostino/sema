"use client";

import { Suspense, useMemo } from "react";
import dynamic from "next/dynamic";
import CorpusTable from "@/components/CorpusTable";
import { useGraphUrlState } from "@/hooks/useGraphUrlState";

const EntityGraphView = dynamic(
  () => import("@/components/EntityGraphView"),
  { ssr: false }
);

function GraphViewRouter() {
  const { state, setState, clearGraphParams } = useGraphUrlState();

  // Memoize so .split() doesn't create a new array reference on every render,
  // which would cause EntityGraphView to re-fetch and reset the network.
  const initialDocFilter = useMemo(
    () => (state.graphDocs ? state.graphDocs.split(",") : undefined),
    [state.graphDocs],
  );

  if (state.view === "graph") {
    return (
      <EntityGraphView
        initialSelectedNode={state.graphNode ?? undefined}
        initialVisibleTypes={state.graphTypes ?? undefined}
        initialDateFrom={state.graphDateFrom ?? undefined}
        initialDateTo={state.graphDateTo ?? undefined}
        initialDocFilter={initialDocFilter}
        onBackToTable={clearGraphParams}
        onStateChange={(graphState) => {
          setState({
            selectedNode: graphState.selectedNode,
            visibleTypes: graphState.visibleTypes,
            dateFrom: graphState.dateFrom,
            dateTo: graphState.dateTo,
          });
        }}
      />
    );
  }

  return <CorpusTable />;
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Suspense fallback={<div className="p-6 text-muted-foreground">Loading…</div>}>
        <GraphViewRouter />
      </Suspense>
    </div>
  );
}
