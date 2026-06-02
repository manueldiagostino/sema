import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { loadFormConfig } from "@/lib/formConfig";
import { generateTeiXml, buildFilename } from "@/lib/xmlBuilder";
import type { FormSubmissionData } from "@/types/form";

const COOKIE_SECRET =
  process.env.COOKIE_SECRET || "default-cookie-secret-change-me-in-production";

// ---------------------------------------------------------------------------
// Multi-file commit helper (Git Trees API for atomic commits)
// ---------------------------------------------------------------------------

interface FileToCommit {
  path: string;
  content: string;
}

async function commitMultipleFiles(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
  message: string,
  files: FileToCommit[],
): Promise<void> {
  // 1. Get current ref SHA
  const { data: ref } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });
  const currentCommitSha = ref.object.sha;

  // 2. Get current tree SHA from the latest commit
  const { data: currentCommit } = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: currentCommitSha,
  });
  const currentTreeSha = currentCommit.tree.sha;

  // 3. Create blobs for each file
  const treeItems = await Promise.all(
    files.map(async (file) => {
      const { data: blob } = await octokit.git.createBlob({
        owner,
        repo,
        content: file.content,
        encoding: "utf-8",
      });
      return {
        path: file.path,
        mode: "100644" as const,
        type: "blob" as const,
        sha: blob.sha,
      };
    }),
  );

  // 4. Create a new tree (based on current tree, adding/replacing our files)
  const { data: newTree } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: currentTreeSha,
    tree: treeItems,
  });

  // 5. Create a new commit
  const { data: newCommit } = await octokit.git.createCommit({
    owner,
    repo,
    message,
    tree: newTree.sha,
    parents: [currentCommitSha],
  });

  // 6. Update the branch ref to point to the new commit
  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: newCommit.sha,
    force: false,
  });
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // ── 1. Check admin session ──
  const session = await getIronSession<{ isAdmin: boolean }>(
    await cookies(),
    {
      cookieName: "admin-session",
      password: COOKIE_SECRET,
      ttl: 60 * 60 * 8, // 8 hours
      cookieOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      },
    },
  );

  if (!session.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. Parse JSON body ──
  let data: FormSubmissionData;
  try {
    const body = await request.json();
    data = body as FormSubmissionData;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  if (!data || !data.charter_type || !data.fields) {
    return NextResponse.json(
      { error: "Missing required fields: charter_type and fields" },
      { status: 400 },
    );
  }

  try {
    // ── 3. Load form config ──
    const config = loadFormConfig();
    const filenameBase = buildFilename(data);

    const cwd = process.cwd();

    // ── 4. Compute progressive number (scan bundled + /tmp dirs) ──
    const teiDirs = [
      join(cwd, "data", "tei-samples"),
      "/tmp/data/tei-samples",
    ];

    const prefix = filenameBase + "_";
    let maxNum = 0;
    for (const dir of teiDirs) {
      try {
        const existing = readdirSync(dir);
        for (const f of existing) {
          if (f.startsWith(prefix) && f.endsWith(".xml")) {
            const numStr = f.slice(prefix.length, f.length - 4);
            const num = parseInt(numStr, 10);
            if (!isNaN(num) && num > maxNum) maxNum = num;
          }
        }
      } catch {
        // Directory doesn't exist yet — continue
      }
    }
    const nextNum = maxNum + 1;
    const numStr = String(nextNum).padStart(2, "0");
    const filename = `${filenameBase}_${numStr}.xml`;
    const docId = `${filenameBase}_${numStr}`;
    const commitMessage = `Add ${data.charter_type} charter document: ${filename}`;

    // ── 5. Generate TEI XML ──
    const xml = generateTeiXml(data, config, docId);

    // ── 5a. Write XML to /tmp (always writable, used by build scripts at runtime) ──
    const tmpTeiDir = "/tmp/data/tei-samples";
    mkdirSync(tmpTeiDir, { recursive: true });
    writeFileSync(join(tmpTeiDir, filename), xml, "utf-8");
    console.log(`[admin/xml] Saved XML to /tmp: ${filename}`);

    // ── 5b. Also write to bundled data/ dir (local dev persistence; fails silently on Vercel) ──
    try {
      const localTeiDir = join(cwd, "data", "tei-samples");
      mkdirSync(localTeiDir, { recursive: true });
      writeFileSync(join(localTeiDir, filename), xml, "utf-8");
      console.log(`[admin/xml] Saved XML locally: ${filename}`);
    } catch {
      // Read-only filesystem (Vercel) — expected, /tmp copy is sufficient
    }

    // ── 6. Regenerate JSON artifacts via build scripts ──
    // Dynamic import: build scripts live outside src/, so we import them
    // at call time. Next.js compiles them as part of the server bundle.
    // Pass BuildConfig so they read from /tmp and write to /tmp/public/.
    let buildCorpus: (config?: { dataDirs?: string[]; outputDir?: string; projectRoot?: string }) => Promise<void>;
    let buildEntityGraph: (config?: { dataDirs?: string[]; outputDir?: string; projectRoot?: string }) => Promise<void>;

    try {
      const corpusModule = await import(
        "../../../../../scripts/build-corpus"
      );
      const entityModule = await import(
        "../../../../../scripts/build-entity-graph"
      );
      buildCorpus = corpusModule.buildCorpus;
      buildEntityGraph = entityModule.buildEntityGraph;
    } catch (importErr) {
      console.error("[admin/xml] Failed to import build scripts:", importErr);
      return NextResponse.json(
        {
          error:
            "Server configuration error: build scripts unavailable. " +
            "Ensure @xmldom/xmldom, xpath, and js-yaml are in dependencies.",
        },
        { status: 500 },
      );
    }

    const buildConfig = {
      dataDirs: ["/tmp/data/tei-samples"],
      outputDir: "/tmp/public",
      projectRoot: cwd,
    };

    try {
      await buildCorpus(buildConfig);
      console.log("[admin/xml] corpus-metadata.json regenerated in /tmp/public");
      await buildEntityGraph(buildConfig);
      console.log("[admin/xml] entity-graph.json regenerated in /tmp/public");
    } catch (buildErr) {
      console.error("[admin/xml] Build script failed:", buildErr);
      return NextResponse.json(
        {
          error:
            "Failed to regenerate corpus data: " +
            (buildErr instanceof Error ? buildErr.message : "Unknown error"),
        },
        { status: 500 },
      );
    }

    // ── 7. Read regenerated JSON files from /tmp/public/ ──
    const tmpPublicDir = "/tmp/public";
    const corpusJson = readFileSync(
      join(tmpPublicDir, "corpus-metadata.json"),
      "utf-8",
    );
    const entityGraphJson = readFileSync(
      join(tmpPublicDir, "entity-graph.json"),
      "utf-8",
    );

    // ── 7. Persist (local fallback or GitHub commit) ──
    const token = process.env.GITHUB_TOKEN;
    const repoEnv = process.env.GITHUB_REPO;

    // Local fallback: XML and JSON already saved to disk by steps above
    if (!token || !repoEnv) {
      console.log("[admin/xml] No GitHub token set — saved locally only");
      return NextResponse.json(
        { success: true, filename, saved: "local" },
        { status: 200 },
      );
    }

    const [owner, repo] = repoEnv.split("/");
    if (!owner || !repo) {
      return NextResponse.json(
        {
          error:
            "Server configuration error: GITHUB_REPO must be in owner/repo format",
        },
        { status: 500 },
      );
    }

    const octokit = new Octokit({ auth: token });
    const branch = process.env.GITHUB_BRANCH || "main";

    // Check if file already exists on GitHub before committing
    try {
      await octokit.repos.getContent({
        owner,
        repo,
        path: `data/tei-samples/${filename}`,
        ref: branch,
      });
      // File exists — return 409
      return NextResponse.json(
        { error: "A document with this filename already exists on GitHub" },
        { status: 409 },
      );
    } catch (checkErr: unknown) {
      // 404 means file doesn't exist — proceed
      const status =
        typeof checkErr === "object" &&
        checkErr !== null &&
        "status" in checkErr
          ? (checkErr as { status: number }).status
          : 0;
      if (status !== 404) {
        console.error("[admin/xml] GitHub check error:", checkErr);
        return NextResponse.json(
          { error: "Failed to check document existence on GitHub" },
          { status: 500 },
        );
      }
    }

    try {
      await commitMultipleFiles(octokit, owner, repo, branch, commitMessage, [
        { path: `data/tei-samples/${filename}`, content: xml },
        { path: "public/corpus-metadata.json", content: corpusJson },
        { path: "public/entity-graph.json", content: entityGraphJson },
      ]);
      console.log(`[admin/xml] Committed to GitHub: ${filename}`);
    } catch (githubError: unknown) {
      console.error("[admin/xml] GitHub commit error:", githubError);
      const message =
        typeof githubError === "object" &&
        githubError !== null &&
        "message" in githubError
          ? String((githubError as { message: string }).message)
          : "Unknown GitHub API error";

      return NextResponse.json(
        { error: `Failed to commit to GitHub: ${message}` },
        { status: 500 },
      );
    }

    // ── 8. Return success ──
    return NextResponse.json(
      { success: true, filename, saved: "github" },
      { status: 200 },
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("[admin/xml] Unexpected error:", error);
    return NextResponse.json(
      { error: `Failed to generate document: ${message}` },
      { status: 500 },
    );
  }
}
