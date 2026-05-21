#!/usr/bin/env tsx
/**
 * build-corpus.ts
 *
 * Reads TEI/XML files from data/tei-samples/ and generates
 * web/public/corpus-metadata.json based on column definitions
 * from web/config/columns.yaml.
 *
 * Run via: npx tsx scripts/build-corpus.ts  (from web/ directory)
 */

import * as fs from "fs";
import * as path from "path";
import yaml from "js-yaml";
import xpath from "xpath";
import { DOMParser } from "@xmldom/xmldom";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ColumnConfig {
  id: string;
  label: string;
  xpath: string;
  sortable?: boolean;
  filterable?: boolean;
  cardinality?: "single" | "multiple";
  join?: string;
  truncateWords?: number;
}

interface ColumnsYaml {
  columns: ColumnConfig[];
}

type CorpusItem = Record<string, string | string[]>;

interface CorpusMetadata {
  columns: ColumnConfig[];
  items: CorpusItem[];
}

// ---------------------------------------------------------------------------
// Paths (relative to web/scripts/)
// ---------------------------------------------------------------------------

const SCRIPT_DIR = __dirname;
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");
const COLUMNS_YAML = path.resolve(PROJECT_ROOT, "config", "columns.yaml");
const TEI_DIR = path.resolve(PROJECT_ROOT, "..", "data", "tei-samples");
const OUTPUT_FILE = path.resolve(PROJECT_ROOT, "public", "corpus-metadata.json");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively extract text content from a DOM node, equivalent to
 * XQuery's string-join($node//text(), ' ').
 */
function extractText(node: Node): string {
  if (node.nodeType === 3) {
    // Text node
    return node.nodeValue || "";
  }
  return Array.from((node as any).childNodes as Node[] || [])
    .map(extractText)
    .filter((t) => t.trim().length > 0)
    .join(" ");
}

/**
 * Recursively find all .xml files under a directory.
 */
function findXmlFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) {
    console.warn(`Warning: TEI directory not found: ${dir}`);
    return results;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findXmlFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".xml")) {
      results.push(fullPath);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  // 1. Load column definitions from YAML
  console.log(`Reading column config from ${COLUMNS_YAML}`);
  const yamlContent = fs.readFileSync(COLUMNS_YAML, "utf-8");
  const parsed = yaml.load(yamlContent) as ColumnsYaml;
  const columns: ColumnConfig[] = parsed.columns;
  console.log(`  Found ${columns.length} column definitions`);

  // 2. Find all TEI/XML files
  const xmlFiles = findXmlFiles(TEI_DIR);
  console.log(`Found ${xmlFiles.length} XML file(s) in ${TEI_DIR}`);

  // 3. Process each file
  const items: CorpusItem[] = [];

  for (const xmlPath of xmlFiles) {
    const relativePath = path.relative(TEI_DIR, xmlPath);
    let xmlContent: string;
    try {
      xmlContent = fs.readFileSync(xmlPath, "utf-8");
    } catch (err) {
      console.warn(`Warning: Could not read ${xmlPath}: ${err}`);
      continue;
    }

    let doc: Document;
    try {
      doc = new DOMParser().parseFromString(xmlContent, "text/xml");
    } catch (err) {
      console.warn(`Warning: XML parse error in ${relativePath}: ${err}`);
      continue;
    }

    // Set up namespace-aware xpath selector
    const select = xpath.useNamespaces({
      tei: "http://www.tei-c.org/ns/1.0",
    });

    const item: CorpusItem = {};

    for (const col of columns) {
      try {
        // Prepend // if not already present so xpath searches from document root
        const xpathExpr = col.xpath.startsWith("//")
          ? col.xpath
          : `//${col.xpath}`;
        const nodes = select(xpathExpr, doc) as Node[];

        if (col.cardinality === "multiple") {
          // Collect ALL matching nodes into a string[]
          let values: string[] = nodes.map(extractText).map((t) => t.trim());
          item[col.id] = values;
        } else {
          // Take the FIRST matching node as string (empty string if no match)
          let value = nodes.length > 0 ? extractText(nodes[0]).trim() : "";
          item[col.id] = value;
        }
      } catch (err) {
        console.warn(
          `Warning: XPath error for column "${col.id}" in ${relativePath}: ${err}`,
        );
        // Set default based on cardinality
        item[col.id] = col.cardinality === "multiple" ? [] : "";
      }
    }

    item.id = path.basename(xmlPath, ".xml");

    items.push(item);
  }

  // 4. Build output
  const metadata: CorpusMetadata = {
    columns,
    items,
  };

  // 5. Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 6. Write JSON (idempotent — overwrites existing file)
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(metadata, null, 2), "utf-8");
  console.log(`Wrote ${items.length} item(s) to ${OUTPUT_FILE}`);
}

main();
