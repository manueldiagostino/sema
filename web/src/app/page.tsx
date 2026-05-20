import { Suspense } from "react";
import CorpusTable from "@/components/CorpusTable";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Suspense fallback={<div className="p-6 text-muted">Loading…</div>}>
        <CorpusTable />
      </Suspense>
    </div>
  );
}
