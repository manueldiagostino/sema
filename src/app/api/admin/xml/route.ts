import { NextResponse } from "next/server";
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";
import { loadFormConfig } from "@/lib/formConfig";
import { generateTeiXml, buildFilename } from "@/lib/xmlBuilder";
import type { FormSubmissionData } from "@/types/form";

import { getActiveTeiDir } from "@/lib/dataDir";
import { autoCommitCorpus } from "@/lib/git";

// ---------------------------------------------------------------------------
// GET handler — download a TEI XML file as raw XML
// Usage: GET /api/admin/xml?filename=iv_000001.xml
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  // ── 1. Parse filename from query ──
  const { searchParams } = new URL(request.url);
  const filename = searchParams.get("filename");

  if (!filename) {
    return NextResponse.json(
      { error: "Missing query parameter: filename" },
      { status: 400 },
    );
  }

  // Basic path-traversal guard: only allow safe filenames (no .., /, or \)
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return NextResponse.json(
      { error: "Invalid filename" },
      { status: 400 },
    );
  }

  // ── 2. Read the file from local TEI directory ──
  const cwd = process.cwd();
  const filePath = join(getActiveTeiDir(cwd), filename);

  try {
    const xml = readFileSync(filePath, "utf-8");
    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "File not found" },
      { status: 404 },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE handler — delete a TEI XML file
// Usage: DELETE /api/admin/xml?filename=iv_000001.xml
// ---------------------------------------------------------------------------

export async function DELETE(request: Request) {
  // ── 1. Parse filename from query ──
  const { searchParams } = new URL(request.url);
  const filename = searchParams.get("filename");

  if (!filename) {
    return NextResponse.json(
      { error: "Missing query parameter: filename" },
      { status: 400 },
    );
  }

  // Basic path-traversal guard
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return NextResponse.json(
      { error: "Invalid filename" },
      { status: 400 },
    );
  }

  // ── 2. Check file exists and delete it ──
  const cwd = process.cwd();
  const filePath = join(getActiveTeiDir(cwd), filename);

  if (!existsSync(filePath)) {
    return NextResponse.json(
      { error: "File not found" },
      { status: 404 },
    );
  }

  try {
    unlinkSync(filePath);
    console.log(`[admin/xml] Deleted XML file: ${filename}`);
  } catch (deleteErr) {
    console.error("[admin/xml] Failed to delete file:", deleteErr);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 },
    );
  }

  // ── 3. Rebuild JSON artifacts ──
  try {
    const corpusModule = await import(
      "../../../../../scripts/build-corpus"
    );
    const entityModule = await import(
      "../../../../../scripts/build-entity-graph"
    );

    // Pass projectRoot because __dirname in Next.js server bundle
    // doesn't resolve to the actual project directory.
    await corpusModule.buildCorpus({ projectRoot: cwd });
    console.log("[admin/xml] corpus-metadata.json rebuilt after deletion");
    await entityModule.buildEntityGraph({ projectRoot: cwd });
    console.log("[admin/xml] entity-graph.json rebuilt after deletion");
  } catch (buildErr) {
    console.error("[admin/xml] Build script failed after deletion:", buildErr);
    return NextResponse.json(
      {
        error:
          "File deleted but failed to rebuild corpus data: " +
          (buildErr instanceof Error ? buildErr.message : "Unknown error"),
      },
      { status: 500 },
    );
  }

  // ── 4. Auto-commit to keep working tree clean ──
  const commitResult = autoCommitCorpus(cwd, `${filename} [delete]`);
  if (commitResult.error) {
    console.warn("[admin/xml] Auto-commit after delete failed:", commitResult.error);
  }

  return NextResponse.json(
    { success: true, deleted: filename },
    { status: 200 },
  );
}

// ---------------------------------------------------------------------------
// POST handler — create or update a TEI XML document
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // ── 1. Parse JSON body ──
  let data: FormSubmissionData & { mode?: "create" | "update"; filename?: string };
  try {
    const body = await request.json();
    data = body as FormSubmissionData & { mode?: "create" | "update"; filename?: string };
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

  const mode = data.mode ?? "create";

  try {
    // ── 2. Load form config ──
    const config = loadFormConfig();
    const cwd = process.cwd();
    const localTeiDir = getActiveTeiDir(cwd);
    mkdirSync(localTeiDir, { recursive: true });

    let filename: string;
    let docId: string;

    if (mode === "update") {
      // ── Update mode: overwrite existing file ──
      if (!data.filename) {
        return NextResponse.json(
          { error: "Missing filename for update mode" },
          { status: 400 },
        );
      }

      // Path-traversal guard on update filename
      if (
        data.filename.includes("..") ||
        data.filename.includes("/") ||
        data.filename.includes("\\")
      ) {
        return NextResponse.json(
          { error: "Invalid filename" },
          { status: 400 },
        );
      }

      filename = data.filename;
      docId = filename.replace(/\.xml$/, "");
    } else {
      // ── Create mode: generate new filename with progressive numbering ──
      const charterCode = buildFilename(data);
      const prefix = charterCode + "_";
      let maxNum = 0;

      try {
        const existing = readdirSync(localTeiDir);
        for (const f of existing) {
          if (f.startsWith(prefix) && f.endsWith(".xml")) {
            const numStr = f.slice(prefix.length, -4); // remove prefix + ".xml"
            const num = parseInt(numStr, 10);
            if (!isNaN(num) && num > maxNum) maxNum = num;
          }
        }
      } catch {
        // Directory doesn't exist yet — continue
      }

      const nextNum = maxNum + 1;
      const numStr = String(nextNum).padStart(6, "0");
      filename = `${charterCode}_${numStr}.xml`;
      docId = `${charterCode}_${numStr}`;
    }

    // ── 3. Generate TEI XML ──
    const xml = generateTeiXml(data, config, docId);

    // ── 4. Write XML to the active TEI directory ──
    writeFileSync(join(localTeiDir, filename), xml, "utf-8");
    console.log(`[admin/xml] Saved XML: ${filename} (mode: ${mode})`);

    // ── 5. Regenerate JSON artifacts via build scripts ──
    let buildCorpus: (config?: { projectRoot?: string }) => Promise<void>;
    let buildEntityGraph: (config?: { projectRoot?: string }) => Promise<void>;

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

    try {
      await buildCorpus({ projectRoot: cwd });
      console.log("[admin/xml] corpus-metadata.json regenerated");
      await buildEntityGraph({ projectRoot: cwd });
      console.log("[admin/xml] entity-graph.json regenerated");
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

    // ── 6. Auto-commit to keep working tree clean ──
    const commitResult = autoCommitCorpus(cwd, `${filename} [${mode}]`);
    if (commitResult.error) {
      console.warn("[admin/xml] Auto-commit after save failed:", commitResult.error);
    }

    // ── 7. Return success ──
    return NextResponse.json(
      { success: true, filename, mode },
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
