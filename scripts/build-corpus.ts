#!/usr/bin/env tsx
/**
 * build-corpus.ts
 *
 * Reads TEI/XML files from data/corpus/ and generates
 * public/corpus-metadata.json based on column definitions
 * from config/columns.yaml.
 *
 * Run via: npx tsx scripts/build-corpus.ts  (from repo root)
 * Import via: import { buildCorpus } from "./scripts/build-corpus";
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
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

interface TypeConfig {
  id: string;
  label: string;
}

interface TypesConfig {
  types: TypeConfig[];
  sections: unknown[];
}

interface CorpusMetadata {
  columns: ColumnConfig[];
  items: CorpusItem[];
  facets: Record<string, { value: string; count: number }[]>;
  charterTypes: { id: string; label: string; count: number }[];
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

import { getActiveTeiDir } from "@/lib/dataDir";
export { getActiveTeiDir };

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

/**
 * Compute facet counts for all filterable columns.
 * For multi-valued fields (arrays), each element is counted separately.
 * Returns a map from column id to sorted {value, count} entries.
 */
function computeFacets(
  items: CorpusItem[],
  columns: ColumnConfig[],
): Record<string, { value: string; count: number }[]> {
  const filterableCols = columns.filter((c) => c.filterable);
  const facets: Record<string, Map<string, number>> = {};

  for (const col of filterableCols) {
    facets[col.id] = new Map();
  }

  for (const item of items) {
    for (const col of filterableCols) {
      const raw = item[col.id];
      const values: string[] = Array.isArray(raw)
        ? raw.filter((v) => v.trim().length > 0)
        : typeof raw === "string" && raw.trim().length > 0
          ? [raw.trim()]
          : [];

      const map = facets[col.id];
      for (const v of values) {
        map.set(v, (map.get(v) || 0) + 1);
      }
    }
  }

  const result: Record<string, { value: string; count: number }[]> = {};
  for (const col of filterableCols) {
    result[col.id] = Array.from(facets[col.id].entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
  }
  return result;
}

/**
 * Derive a short code from a charter type ID (same algorithm as xmlBuilder).
 * Multi-word IDs: first letter of each word. Single-word: first two letters.
 */
function deriveCode(typeId: string): string {
  const parts = typeId.split("_");
  if (parts.length >= 2) {
    return parts.map((p) => p[0]).join("").toLowerCase();
  }
  return typeId.slice(0, 2).toLowerCase();
}

/**
 * Extract charter types from document IDs and map them to human-readable labels.
 * New ID format: <code>_<NNNNNN> where prefix (before last _) is the charter code.
 */
function extractCharterTypes(
  items: CorpusItem[],
  formConfig: TypesConfig,
): { id: string; label: string; count: number }[] {
  // Build code → typeId lookup
  const codeToTypeId = new Map<string, string>();
  for (const t of formConfig.types) {
    const code = deriveCode(t.id);
    codeToTypeId.set(code, t.id);
  }

  const typeCounts = new Map<string, number>();

  for (const item of items) {
    const docId = typeof item.id === "string" ? item.id : "";
    // New format: <code>_<NNNNNN>
    const lastUnderscore = docId.lastIndexOf("_");
    const prefix = lastUnderscore >= 0 ? docId.slice(0, lastUnderscore) : docId;
    typeCounts.set(prefix, (typeCounts.get(prefix) || 0) + 1);
  }

  const typeLookup = new Map<string, string>();
  for (const t of formConfig.types) {
    typeLookup.set(t.id, t.label);
  }

  const result: { id: string; label: string; count: number }[] = [];
  for (const [prefix, count] of typeCounts) {
    // Map code back to type ID
    const typeId = codeToTypeId.get(prefix);
    let label: string;
    if (typeId) {
      label = typeLookup.get(typeId) ?? typeId;
    } else {
      label = prefix
        .replace(/_/g, " ")
        .replace(/\b\w/g, (ch) => ch.toUpperCase());
    }
    result.push({ id: prefix, label, count });
  }

  return result.sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function buildCorpus(config?: BuildConfig): Promise<void> {
  // Compute paths: use projectRoot from config, or fall back to __dirname
  const root = config?.projectRoot ?? path.resolve(__dirname, "..");
  const columnsYaml = path.join(root, "config", "columns.yaml");
  const defaultTeiDir = getActiveTeiDir(root);
  console.log(`Active TEI directory: ${defaultTeiDir}`);
  const defaultOutputFile = path.join(root, "public", "corpus-metadata.json");

  // 1. Load column definitions from YAML
  console.log(`Reading column config from ${columnsYaml}`);
  const yamlContent = fs.readFileSync(columnsYaml, "utf-8");
  const parsed = yaml.load(yamlContent) as ColumnsYaml;
  const columns: ColumnConfig[] = parsed.columns;
  console.log(`  Found ${columns.length} column definitions`);

  // 2. Find all TEI/XML files (explicit dirs override the active directory)
  const dataDirs = config?.dataDirs && config.dataDirs.length > 0 ? [...config.dataDirs] : [defaultTeiDir];
  const xmlFiles = findXmlFiles(dataDirs);
  console.log(`Found ${xmlFiles.length} XML file(s) across ${dataDirs.length} dir(s)`);

  if (xmlFiles.length === 0) {
    throw new Error(`No XML files found in: ${dataDirs.join(", ")}. Ensure data/corpus/ or data/fake/ contains .xml files.`);
  }

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

  // 4. Load form-sections.yaml for charter type extraction
  const formSectionsYaml = path.join(root, "config", "form-sections.yaml");
  console.log(`Reading form sections from ${formSectionsYaml}`);
  const formYamlContent = fs.readFileSync(formSectionsYaml, "utf-8");
  const typesConfig = yaml.load(formYamlContent) as TypesConfig;
  console.log(`  Found ${typesConfig.types.length} charter type(s)`);

  // 5. Compute facets and charter types
  const facets = computeFacets(items, columns);
  const charterTypes = extractCharterTypes(items, typesConfig);
  console.log(`  Computed facets for ${Object.keys(facets).length} column(s)`);
  console.log(`  Found ${charterTypes.length} charter type(s)`);

  // 6. Build output
  const metadata: CorpusMetadata = {
    columns,
    items,
    facets,
    charterTypes,
  };

  // 7. Determine output path (config overrides default)
  const outputFile = config?.outputDir
    ? path.join(config.outputDir, "corpus-metadata.json")
    : defaultOutputFile;

  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 8. Write JSON (idempotent — overwrites existing file)
  fs.writeFileSync(outputFile, JSON.stringify(metadata, null, 2), "utf-8");
  console.log(`Wrote ${items.length} item(s) to ${outputFile}`);
}

// ESM-safe equivalents of CJS __filename / __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CLI entry point
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(__filename)) {
  buildCorpus().catch((err) => {
    console.error("buildCorpus failed:", err);
    process.exit(1);
  });
}
