import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import React from "react";
import { renderToStream } from "@react-pdf/renderer";
import { loadExportConfig } from "@/lib/schema/views";
import { loadTeiSchema } from "@/lib/schema/registry";
import type { CorpusMetadata } from "@/types/corpus";
import FormularyPdf from "@/lib/pdfFormulary";

const CACHE: { data: CorpusMetadata | null } = { data: null };

function loadCorpusMetadata(): CorpusMetadata {
  if (CACHE.data) return CACHE.data;
  const filePath = join(process.cwd(), "public", "corpus-metadata.json");
  const raw = readFileSync(filePath, "utf-8");
  CACHE.data = JSON.parse(raw) as CorpusMetadata;
  return CACHE.data;
}

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

  // Basic path-traversal guard
  if (
    filename.includes("..") ||
    filename.includes("/") ||
    filename.includes("\\")
  ) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  // ── 2. Find CorpusItem by filename ──
  const docId = filename.replace(/\.xml$/i, "");
  let corpus: CorpusMetadata;
  try {
    corpus = loadCorpusMetadata();
  } catch {
    return NextResponse.json(
      { error: "Corpus metadata not found" },
      { status: 500 },
    );
  }

  const item = corpus.items.find((i) => i.id === docId);
  if (!item) {
    return NextResponse.json(
      { error: "Document not found in corpus" },
      { status: 404 },
    );
  }

  // ── 3. Load configs ──
  const exportConfig = loadExportConfig();
  const teiSchema = loadTeiSchema();

  // ── 4. Generate PDF ──
  try {
    const pdfBuffer = await renderToStream(
      <FormularyPdf
        item={item}
        sections={exportConfig.sections}
        schema={teiSchema}
      />,
    );

    return new Response(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${docId}_formulary.pdf"`,
      },
    });
  } catch (err) {
    console.error("[pdf/formulary] Generation failed:", err);
    return NextResponse.json(
      { error: "PDF generation failed" },
      { status: 500 },
    );
  }
}
