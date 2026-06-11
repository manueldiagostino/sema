#!/usr/bin/env tsx
/**
 * build-xml-copy.ts
 *
 * Copies TEI XML files from the active data directory to public/xml/
 * so they're available as static assets in the statically exported site
 * (e.g. GitHub Pages), where API routes are unavailable.
 *
 * Run via: npx tsx scripts/build-xml-copy.ts  (from repo root)
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

// Determine active TEI dir (mirrors src/lib/dataDir.ts logic)
const fakeDir = path.join(root, "data", "fake");
const teiDir = fs.existsSync(fakeDir)
  ? fakeDir
  : path.join(root, "data", "corpus");

const outDir = path.join(root, "public", "xml");

if (!fs.existsSync(teiDir)) {
  console.warn(`[build-xml-copy] TEI directory not found: ${teiDir} — skipping`);
  process.exit(0);
}

// Ensure output directory exists
fs.mkdirSync(outDir, { recursive: true });

// Copy all .xml files
let count = 0;
for (const entry of fs.readdirSync(teiDir)) {
  if (entry.endsWith(".xml")) {
    fs.copyFileSync(path.join(teiDir, entry), path.join(outDir, entry));
    count++;
  }
}

console.log(`[build-xml-copy] Copied ${count} XML file(s) to ${outDir}`);
