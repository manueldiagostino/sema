import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const TMP_GRAPH = join("/tmp", "public", "entity-graph.json");

/**
 * GET /api/graph
 *
 * Serves the entity graph JSON. Priority:
 *   1. /tmp/public/entity-graph.json   (warm cache — latest state)
 *   2. public/entity-graph.json         (build-time static fallback)
 */
export async function GET(): Promise<NextResponse> {
  try {
    // 1. Serve from /tmp (warm cache — reflects latest saves)
    if (existsSync(TMP_GRAPH)) {
      const data = readFileSync(TMP_GRAPH, "utf-8");
      return new NextResponse(data, {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        },
      });
    }

    // 2. Fallback: build-time static file
    const staticFile = join(process.cwd(), "public", "entity-graph.json");
    if (existsSync(staticFile)) {
      const data = readFileSync(staticFile, "utf-8");
      return new NextResponse(data, {
        headers: { "Content-Type": "application/json" },
      });
    }

    return NextResponse.json(
      { error: "Entity graph data not available" },
      { status: 404 },
    );
  } catch (err) {
    console.error("[api/graph]", err);
    return NextResponse.json(
      { error: "Failed to load entity graph data" },
      { status: 500 },
    );
  }
}
