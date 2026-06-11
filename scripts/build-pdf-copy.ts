#!/usr/bin/env tsx
/**
 * build-pdf-copy.ts
 *
 * Pre-generates Formulary Analysis PDFs from all TEI XML files
 * and saves them to public/pdf/ so they're available as static
 * assets on the statically exported site (e.g. GitHub Pages).
 *
 * Run via: npx tsx scripts/build-pdf-copy.ts  (from repo root)
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import FormularyPdf from "../src/lib/pdfFormulary";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

// Determine active TEI dir (mirrors src/lib/dataDir.ts logic)
const fakeDir = path.join(root, "data", "fake");
const teiDir = fs.existsSync(fakeDir)
  ? fakeDir
  : path.join(root, "data", "corpus");

const outDir = path.join(root, "public", "pdf");

if (!fs.existsSync(teiDir)) {
  console.warn(
    `[build-pdf-copy] TEI directory not found: ${teiDir} — skipping`,
  );
  process.exit(0);
}

fs.mkdirSync(outDir, { recursive: true });

const xmlFiles = fs
  .readdirSync(teiDir)
  .filter((f) => f.endsWith(".xml"));
console.log(
  `[build-pdf-copy] Generating PDFs for ${xmlFiles.length} XML file(s)...`,
);

async function main() {
  let count = 0;
  for (const file of xmlFiles) {
    const docId = path.basename(file, ".xml");
    const xmlContent = fs.readFileSync(path.join(teiDir, file), "utf-8");

    const pdfFilename = `${docId}_formulary.pdf`;
    const outputPath = path.join(outDir, pdfFilename);

    try {
      const buffer = await renderToBuffer(
        React.createElement(FormularyPdf, { xmlContent }) as any,
      );
      fs.writeFileSync(outputPath, buffer);
      console.log(
        `  ✓ ${pdfFilename} (${(buffer.length / 1024).toFixed(1)} KB)`,
      );
      count++;
    } catch (err) {
      console.error(
        `  ✗ ${pdfFilename}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  console.log(
    `[build-pdf-copy] Generated ${count}/${xmlFiles.length} PDF(s) to ${outDir}`,
  );

  // Exit with error code if any PDF failed
  if (count < xmlFiles.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[build-pdf-copy] Fatal error:", err);
  process.exit(1);
});
