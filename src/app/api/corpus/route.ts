import { NextResponse } from "next/server";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const TMP_CORPUS = join("/tmp", "public", "corpus-metadata.json");

/**
 * GET /api/corpus
 *
 * Serves the corpus metadata JSON. Priority:
 *   1. /tmp/public/corpus-metadata.json  (warm cache — latest state)
 *   2. GitHub raw/API                     (cold start recovery)
 *   3. public/corpus-metadata.json        (build-time static fallback)
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

    // 2. Cold start recovery: fetch latest from GitHub
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || "main";
    const token = process.env.GITHUB_TOKEN;

    if (repo) {
      let data: string | null = null;

      if (token) {
        // Private repo: use GitHub Contents API with auth
        const apiUrl = `https://api.github.com/repos/${repo}/contents/public/corpus-metadata.json?ref=${branch}`;
        const apiRes = await fetch(apiUrl, {
          headers: {
            Accept: "application/vnd.github.v3.raw",
            Authorization: `Bearer ${token}`,
          },
        });
        if (apiRes.ok) {
          data = await apiRes.text();
        }
      } else {
        // Public repo: use raw.githubusercontent.com (no auth needed)
        const rawUrl = `https://raw.githubusercontent.com/${repo}/${branch}/public/corpus-metadata.json`;
        const rawRes = await fetch(rawUrl);
        if (rawRes.ok) {
          data = await rawRes.text();
        }
      }

      if (data) {
        // Cache in /tmp for subsequent requests
        const tmpDir = join("/tmp", "public");
        mkdirSync(tmpDir, { recursive: true });
        writeFileSync(TMP_CORPUS, data, "utf-8");
        return new NextResponse(data, {
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // 3. Fallback: build-time static file
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
