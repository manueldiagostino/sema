import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import React from "react";
import { renderToStream } from "@react-pdf/renderer";
import { getActiveTeiDir } from "@/lib/dataDir";
import FormularyPdf from "@/lib/pdfFormulary";

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

  // ── 2. Read the TEI XML file ──
  const cwd = process.cwd();
  const filePath = join(getActiveTeiDir(cwd), filename);

  let xmlContent: string;
  try {
    xmlContent = readFileSync(filePath, "utf-8");
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  // ── 3. Generate PDF ──
  try {
    const pdfBuffer = await renderToStream(
      <FormularyPdf xmlContent={xmlContent} />,
    );

    return new Response(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename.replace(/\.xml$/, "")}_formulary.pdf"`,
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
