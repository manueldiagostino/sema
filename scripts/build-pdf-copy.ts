#!/usr/bin/env tsx
/**
 * build-pdf-copy.ts
 *
 * Pre-generates Formulary Analysis PDFs from corpus-metadata.json data
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
import { loadExportConfig } from "../src/lib/schema/views";
import { loadTeiSchema } from "../src/lib/schema/registry";
import type { CorpusMetadata } from "../src/types/corpus";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const metadataPath = path.join(root, "public", "corpus-metadata.json");
const outDir = path.join(root, "public", "pdf");

if (!fs.existsSync(metadataPath)) {
  console.warn(
    `[build-pdf-copy] corpus-metadata.json not found at ${metadataPath} — skipping`,
  );
  process.exit(0);
}

fs.mkdirSync(outDir, { recursive: true });

// Load corpus metadata
const raw = fs.readFileSync(metadataPath, "utf-8");
const corpus = JSON.parse(raw) as CorpusMetadata;
const items = corpus.items;

console.log(
  `[build-pdf-copy] Generating PDFs for ${items.length} document(s)...`,
);

// Load configs
const exportConfig = loadExportConfig();
const sections = exportConfig.sections;
const teiSchema = loadTeiSchema();

async function main() {
  let count = 0;
  for (const item of items) {
    const docId = item.id;
    const pdfFilename = `${docId}_formulary.pdf`;
    const outputPath = path.join(outDir, pdfFilename);

    try {
      const buffer = await renderToBuffer(
        React.createElement(FormularyPdf, { item, sections, schema: teiSchema }) as any,
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
    `[build-pdf-copy] Generated ${count}/${items.length} PDF(s) to ${outDir}`,
  );

  // Exit with error code if any PDF failed
  if (count < items.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[build-pdf-copy] Fatal error:", err);
  process.exit(1);
});
