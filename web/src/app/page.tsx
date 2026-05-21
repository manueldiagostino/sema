"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import CorpusTable from "@/components/CorpusTable";
import { useGraphUrlState } from "@/hooks/useGraphUrlState";

const EntityGraphView = dynamic(
  () => import("@/components/EntityGraphView"),
  { ssr: false }
);

function GraphViewRouter() {
  const { state, setState, clearGraphParams } = useGraphUrlState();

  if (state.view === "graph") {
    return (
      <EntityGraphView
        initialSelectedNode={state.graphNode ?? undefined}
        initialVisibleTypes={state.graphTypes ?? undefined}
        initialDateFrom={state.graphDateFrom ?? undefined}
        initialDateTo={state.graphDateTo ?? undefined}
        initialDocFilter={state.graphDocs ? state.graphDocs.split(",") : undefined}
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
      <Suspense fallback={<div className="p-6 text-muted">Loading…</div>}>
        <GraphViewRouter />
      </Suspense>
    </div>
  );
}
