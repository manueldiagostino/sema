#!/usr/bin/env tsx
/**
 * build-corpus.ts
 *
 * Reads TEI/XML files from data/tei-samples/ and generates
 * public/corpus-metadata.json based on column definitions
 * from config/columns.yaml.
 *
 * Run via: npx tsx scripts/build-corpus.ts  (from repo root)
 * Import via: import { buildCorpus } from "./scripts/build-corpus";
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

/** Configuration passed at call time (API routes) to override default paths. */
export interface BuildConfig {
  /** Additional directories to scan for XML files (beyond the default defaultTeiDir). */
  dataDirs?: string[];
  /** Override the output directory for the generated JSON file. */
  outputDir?: string;
  /** Project root directory. Falls back to __dirname-based path when not provided. */
  projectRoot?: string;
}

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
 * Find all .xml files across multiple directories.
 * Deduplicates by filename (first directory wins).
 */
function findXmlFiles(dirs: string[]): string[] {
  const seen = new Set<string>();
  const results: string[] = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      console.warn(`Warning: TEI directory not found: ${dir}`);
      continue;
    }
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findXmlFiles([fullPath]));
      } else if (entry.isFile() && entry.name.endsWith(".xml")) {
        if (seen.has(entry.name)) continue;
        seen.add(entry.name);
        results.push(fullPath);
      }
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function buildCorpus(config?: BuildConfig): Promise<void> {
  // Compute paths: use projectRoot from config, or fall back to __dirname
  const root = config?.projectRoot ?? path.resolve(__dirname, "..");
  const columnsYaml = path.join(root, "config", "columns.yaml");
  const defaultTeiDir = path.join(root, "data", "tei-samples");
  const defaultOutputFile = path.join(root, "public", "corpus-metadata.json");

  // 1. Load column definitions from YAML
  console.log(`Reading column config from ${columnsYaml}`);
  const yamlContent = fs.readFileSync(columnsYaml, "utf-8");
  const parsed = yaml.load(yamlContent) as ColumnsYaml;
  const columns: ColumnConfig[] = parsed.columns;
  console.log(`  Found ${columns.length} column definitions`);

  // 2. Find all TEI/XML files (default dir + any additional dirs from config)
  const dataDirs = [defaultTeiDir, ...(config?.dataDirs || [])];
  const xmlFiles = findXmlFiles(dataDirs);
  console.log(`Found ${xmlFiles.length} XML file(s) across ${dataDirs.length} dir(s)`);

  // 3. Process each file
  const items: CorpusItem[] = [];

  for (const xmlPath of xmlFiles) {
    const relativePath = path.relative(defaultTeiDir, xmlPath);
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

  // 5. Determine output path (config overrides default)
  const outputFile = config?.outputDir
    ? path.join(config.outputDir, "corpus-metadata.json")
    : defaultOutputFile;

  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 6. Write JSON (idempotent — overwrites existing file)
  fs.writeFileSync(outputFile, JSON.stringify(metadata, null, 2), "utf-8");
  console.log(`Wrote ${items.length} item(s) to ${outputFile}`);
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  buildCorpus().catch((err) => {
    console.error("buildCorpus failed:", err);
    process.exit(1);
  });
}
