import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const TMP_CORPUS = join("/tmp", "public", "corpus-metadata.json");

/**
 * GET /api/corpus
 *
 * Serves the corpus metadata JSON. Priority:
 *   1. /tmp/public/corpus-metadata.json  (warm cache — latest state)
 *   2. public/corpus-metadata.json        (build-time static fallback)
 */
export async function GET(): Promise<NextResponse> {
  try {
    // 1. Serve from /tmp (warm cache — reflects latest saves)
    if (existsSync(TMP_CORPUS)) {
      const data = readFileSync(TMP_CORPUS, "utf-8");
      return new NextResponse(data, {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        },
      });
    }

    // 2. Fallback: build-time static file
    const staticFile = join(process.cwd(), "public", "corpus-metadata.json");
    if (existsSync(staticFile)) {
      const data = readFileSync(staticFile, "utf-8");
      return new NextResponse(data, {
        headers: { "Content-Type": "application/json" },
      });
    }

    return NextResponse.json(
      { error: "Corpus data not available" },
      { status: 404 },
    );
  } catch (err) {
    console.error("[api/corpus]", err);
    return NextResponse.json(
      { error: "Failed to load corpus data" },
      { status: 500 },
    );
  }
}
