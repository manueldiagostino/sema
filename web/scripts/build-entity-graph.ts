#!/usr/bin/env tsx
/**
 * build-entity-graph.ts
 *
 * Reads TEI/XML files from data/tei-samples/ and generates
 * web/public/entity-graph.json — a knowledge graph of persons,
 * institutions, places, documents, and document types with edges
 * representing relationships between them.
 *
 * Run via: npx tsx scripts/build-entity-graph.ts  (from web/ directory)
 */

import * as fs from "fs";
import * as path from "path";
import yaml from "js-yaml";
import xpath from "xpath";
import { DOMParser } from "@xmldom/xmldom";

// ---------------------------------------------------------------------------
// Types (mirroring web/src/types/entity-graph.ts)
// ---------------------------------------------------------------------------

type EntityType =
  | "person"
  | "clan"
  | "institution"
  | "document"
  | "document_type"
  | "place";

type EdgeType =
  | "signs"
  | "witnesses"
  | "notarizes"
  | "receives"
  | "has_type"
  | "created_in"
  | "belongs_to_clan"
  | "co_occurs";

interface EntityNode {
  id: string;
  type: EntityType;
  label: string;
  roles?: string[];
  clan?: string;
  date?: string;
  docType?: string;
  archive?: string;
  fileId?: string;
  memberCount?: number;
  instType?: string;
}

interface EntityEdge {
  source: string;
  target: string;
  type: EdgeType;
}

interface EntityGraph {
  nodes: EntityNode[];
  edges: EntityEdge[];
}

// ---------------------------------------------------------------------------
// Paths (relative to web/scripts/)
// ---------------------------------------------------------------------------

const SCRIPT_DIR = __dirname;
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");
const COLUMNS_YAML = path.resolve(PROJECT_ROOT, "config", "columns.yaml");
const TEI_DIR = path.resolve(PROJECT_ROOT, "..", "data", "tei-samples");
const OUTPUT_FILE = path.resolve(PROJECT_ROOT, "public", "entity-graph.json");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively extract text content from a DOM node.
 */
function extractText(node: Node): string {
  if (node.nodeType === 3) {
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

/**
 * Normalize a name for deduplication and ID generation.
 */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Generate a stable node ID for non-document, non-clan, non-doctype entities.
 */
function makeEntityId(type: EntityType, label: string): string {
  return `${type}_${normalizeName(label)}`;
}

/**
 * Compute Levenshtein distance between two strings.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0),
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[m][n];
}

/**
 * Extract year from an ISO date string (e.g., "1145-06-08" → 1145).
 */
function extractYear(isoDate: string): number | null {
  const match = isoDate.match(/^(\d{4})/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Derive clan name from a person's name.
 * - Pattern `de <Word>` where Word starts with uppercase → clan name
 * - Pattern `filius <Word>` → patronymic clan (only if no `de` pattern matched)
 */
function deriveClan(name: string): string | null {
  // Try "de <Word>" pattern first
  const deMatch = name.match(/\bde\s+([A-Z]\w*)/);
  if (deMatch) {
    return deMatch[1];
  }
  // Try "filius <Word>" pattern
  const filiusMatch = name.match(/\bfilius\s+([A-Z]\w*)/);
  if (filiusMatch) {
    return filiusMatch[1];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Entity extraction functions
// ---------------------------------------------------------------------------

type SelectFn = ReturnType<typeof xpath.useNamespaces>;

interface PartialEntityNode {
  type: EntityType;
  label: string;
  roles?: string[];
  clan?: string;
  date?: string;
  docType?: string;
  archive?: string;
  fileId?: string;
  instType?: string;
}

/**
 * Extract person entities (signer, notary, witnesses) from a document.
 */
function extractPersons(
  doc: Document,
  select: SelectFn,
  fileName: string,
  docDate: string,
): PartialEntityNode[] {
  const persons: PartialEntityNode[] = [];

  // Signer: titleStmt/author
  const authorNodes = select(
    "//tei:teiHeader/tei:fileDesc/tei:titleStmt/tei:author",
    doc,
  ) as Node[];
  for (const node of authorNodes) {
    const label = extractText(node).trim();
    if (label) {
      persons.push({
        type: "person",
        label,
        roles: ["signer"],
      });
    }
  }

  // Notary: msItem/respStmt/name
  const notaryNodes = select(
    "//tei:teiHeader/tei:fileDesc/tei:sourceDesc/tei:msDesc/tei:msContents/tei:msItem/tei:respStmt/tei:name",
    doc,
  ) as Node[];
  for (const node of notaryNodes) {
    const label = extractText(node).trim();
    if (label) {
      persons.push({
        type: "person",
        label,
        roles: ["notary"],
      });
    }
  }

  // Witnesses: listWitness/witness/name
  const witnessNodes = select(
    "//tei:text/tei:body/tei:listWitness/tei:witness/tei:name",
    doc,
  ) as Node[];
  for (const node of witnessNodes) {
    const label = extractText(node).trim();
    if (label) {
      persons.push({
        type: "person",
        label,
        roles: ["witness"],
      });
    }
  }

  return persons;
}

/**
 * Extract institution entities (recipient) from a document.
 */
function extractInstitutions(
  doc: Document,
  select: SelectFn,
): PartialEntityNode[] {
  const institutions: PartialEntityNode[] = [];

  const recipientNodes = select(
    "//tei:teiHeader/tei:fileDesc/tei:sourceDesc/tei:msDesc/tei:msContents/tei:msItem/tei:recipient",
    doc,
  ) as Node[];
  for (const node of recipientNodes) {
    const label = extractText(node).trim();
    if (label) {
      institutions.push({
        type: "institution",
        label,
      });
    }
  }

  return institutions;
}

/**
 * Extract place entities (origPlace, settlement) from a document.
 */
function extractPlaces(
  doc: Document,
  select: SelectFn,
): PartialEntityNode[] {
  const places: PartialEntityNode[] = [];

  // origPlace: creation/origPlace
  const origPlaceNodes = select(
    "//tei:teiHeader/tei:profileDesc/tei:creation/tei:origPlace",
    doc,
  ) as Node[];
  for (const node of origPlaceNodes) {
    const label = extractText(node).trim();
    if (label) {
      places.push({
        type: "place",
        label,
      });
    }
  }

  // settlement: msIdentifier/settlement
  const settlementNodes = select(
    "//tei:teiHeader/tei:fileDesc/tei:sourceDesc/tei:msDesc/tei:msIdentifier/tei:settlement",
    doc,
  ) as Node[];
  for (const node of settlementNodes) {
    const label = extractText(node).trim();
    if (label) {
      places.push({
        type: "place",
        label,
      });
    }
  }

  return places;
}

/**
 * Create a document entity node.
 */
function createDocumentNode(
  doc: Document,
  select: SelectFn,
  fileName: string,
): PartialEntityNode {
  const docId = path.basename(fileName, ".xml");

  // Document title
  const titleNodes = select(
    "//tei:teiHeader/tei:fileDesc/tei:titleStmt/tei:title",
    doc,
  ) as Node[];
  const label =
    titleNodes.length > 0 ? extractText(titleNodes[0]).trim() : docId;

  // ISO date from @when attribute
  const dateNodes = select(
    "//tei:teiHeader/tei:profileDesc/tei:creation/tei:date",
    doc,
  ) as Node[];
  const dateAttr =
    dateNodes.length > 0
      ? ((dateNodes[0] as any).getAttribute?.("when") as string | null)
      : null;
  const date = dateAttr || "";

  // Document type keyword
  const docTypeNodes = select(
    "//tei:teiHeader/tei:profileDesc/tei:textClass/tei:keywords/tei:term[@type='object']",
    doc,
  ) as Node[];
  const docType =
    docTypeNodes.length > 0 ? extractText(docTypeNodes[0]).trim() : "";

  // Archive repository
  const archiveNodes = select(
    "//tei:teiHeader/tei:fileDesc/tei:sourceDesc/tei:msDesc/tei:msIdentifier/tei:repository",
    doc,
  ) as Node[];
  const archive =
    archiveNodes.length > 0 ? extractText(archiveNodes[0]).trim() : "";

  return {
    type: "document",
    label,
    date,
    docType,
    archive,
    fileId: docId,
  };
}

/**
 * Create a document type entity node.
 */
function createDocumentTypeNode(
  doc: Document,
  select: SelectFn,
): PartialEntityNode | null {
  const docTypeNodes = select(
    "//tei:teiHeader/tei:profileDesc/tei:textClass/tei:keywords/tei:term[@type='object']",
    doc,
  ) as Node[];
  if (docTypeNodes.length === 0) return null;

  const label = extractText(docTypeNodes[0]).trim();
  if (!label) return null;

  return {
    type: "document_type",
    label,
  };
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

/**
 * Phase 1: Merge entities with exact normalized name match + same type.
 */
function deduplicatePhase1(
  nodes: PartialEntityNode[],
): PartialEntityNode[] {
  const merged: Map<string, PartialEntityNode> = new Map();

  for (const node of nodes) {
    const key = `${node.type}_${normalizeName(node.label)}`;
    const existing = merged.get(key);
    if (existing) {
      // Merge roles
      if (node.roles) {
        existing.roles = existing.roles
          ? [...new Set([...existing.roles, ...node.roles])]
          : [...node.roles];
      }
    } else {
      merged.set(key, { ...node, roles: node.roles ? [...node.roles] : [] });
    }
  }

  return Array.from(merged.values());
}

/**
 * Phase 2: For unmatched persons, merge if Levenshtein distance ≤ 2
 * AND documents they appear in are within 50 years.
 */
function deduplicatePhase2(
  nodes: PartialEntityNode[],
  docDateMap: Map<string, string>,
): PartialEntityNode[] {
  // Only process person nodes
  const personNodes = nodes.filter((n) => n.type === "person");
  const otherNodes = nodes.filter((n) => n.type !== "person");

  // Build a map from normalized name to the node (for persons already merged in phase 1)
  const personMap: Map<string, PartialEntityNode> = new Map();
  for (const node of personNodes) {
    const key = normalizeName(node.label);
    if (!personMap.has(key)) {
      personMap.set(key, { ...node, roles: node.roles ? [...node.roles] : [] });
    }
  }

  const personArray = Array.from(personMap.values());
  const merged: Set<number> = new Set();
  const result: PartialEntityNode[] = [];

  for (let i = 0; i < personArray.length; i++) {
    if (merged.has(i)) continue;

    const current = personArray[i];
    const currentNorm = normalizeName(current.label);

    // Find candidates to merge with
    for (let j = i + 1; j < personArray.length; j++) {
      if (merged.has(j)) continue;

      const candidate = personArray[j];
      const candidateNorm = normalizeName(candidate.label);

      const dist = levenshtein(currentNorm, candidateNorm);
      if (dist > 2) continue;

      // Check date proximity: collect all document dates for both entities
      // Since we don't have direct doc links here, we use the docDateMap
      // which maps docId → ISO date. We need to check if there's any overlap.
      // For simplicity, we check if the documents are within 50 years.
      // We'll use a heuristic: if both have roles, they appear in documents.
      // We need to track which documents each entity appears in.
      // Since we don't have that info at this stage, we'll pass it through.
      // For now, we'll accept the merge if Levenshtein ≤ 2.
      // The date check requires document linkage info.

      // We'll do the date check in the main function where we have doc linkage.
      // For now, mark as mergeable by name similarity.
      console.log(
        `  Phase 2 merge candidate: "${current.label}" ↔ "${candidate.label}" (distance: ${dist})`,
      );
    }

    result.push(current);
  }

  return [...result, ...otherNodes];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  // 1. Load column definitions from YAML (for validation / context)
  console.log(`Reading column config from ${COLUMNS_YAML}`);
  const yamlContent = fs.readFileSync(COLUMNS_YAML, "utf-8");
  const parsed = yaml.load(yamlContent) as { columns: unknown[] };
  console.log(`  Found ${parsed.columns.length} column definitions`);

  // 2. Find all TEI/XML files
  const xmlFiles = findXmlFiles(TEI_DIR);
  console.log(`Found ${xmlFiles.length} XML file(s) in ${TEI_DIR}`);

  // 3. Process each file — collect raw nodes and edges
  const allRawNodes: PartialEntityNode[] = [];
  const allEdges: EntityEdge[] = [];
  // Track which documents each person appears in (for Phase 2 date check)
  const personDocDates: Map<string, number[]> = new Map();
  // Map docId → ISO date
  const docDateMap: Map<string, string> = new Map();

  for (const xmlPath of xmlFiles) {
    const relativePath = path.relative(TEI_DIR, xmlPath);
    const fileName = path.basename(xmlPath);
    const docId = path.basename(xmlPath, ".xml");

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

    // Extract document date
    const dateNodes = select(
      "//tei:teiHeader/tei:profileDesc/tei:creation/tei:date",
      doc,
    ) as Node[];
    const dateAttr =
      dateNodes.length > 0
        ? ((dateNodes[0] as any).getAttribute?.("when") as string | null)
        : null;
    const docDate = dateAttr || "";
    docDateMap.set(docId, docDate);
    const docYear = extractYear(docDate);

    // Extract entities
    const persons = extractPersons(doc, select, fileName, docDate);
    const institutions = extractInstitutions(doc, select);
    const places = extractPlaces(doc, select);
    const docNode = createDocumentNode(doc, select, fileName);
    const docTypeNode = createDocumentTypeNode(doc, select);

    // Build node IDs for this document's entities
    const signerNodes = persons.filter((p) => p.roles?.includes("signer"));
    const notaryNodes = persons.filter((p) => p.roles?.includes("notary"));
    const witnessNodes = persons.filter((p) => p.roles?.includes("witness"));

    // Add all raw nodes
    allRawNodes.push(...persons, ...institutions, ...places, docNode);
    if (docTypeNode) allRawNodes.push(docTypeNode);

    // Build edges
    // signer → signs → document
    for (const signer of signerNodes) {
      const signerId = makeEntityId("person", signer.label);
      allEdges.push({ source: signerId, target: docId, type: "signs" });
      // Track document dates for this person
      if (docYear !== null) {
        const key = normalizeName(signer.label);
        if (!personDocDates.has(key)) personDocDates.set(key, []);
        personDocDates.get(key)!.push(docYear);
      }
    }

    // notary → notarizes → document
    for (const notary of notaryNodes) {
      const notaryId = makeEntityId("person", notary.label);
      allEdges.push({ source: notaryId, target: docId, type: "notarizes" });
      if (docYear !== null) {
        const key = normalizeName(notary.label);
        if (!personDocDates.has(key)) personDocDates.set(key, []);
        personDocDates.get(key)!.push(docYear);
      }
    }

    // each witness → witnesses → document
    const witnessIds: string[] = [];
    for (const witness of witnessNodes) {
      const witnessId = makeEntityId("person", witness.label);
      allEdges.push({ source: witnessId, target: docId, type: "witnesses" });
      witnessIds.push(witnessId);
      if (docYear !== null) {
        const key = normalizeName(witness.label);
        if (!personDocDates.has(key)) personDocDates.set(key, []);
        personDocDates.get(key)!.push(docYear);
      }
    }

    // witness pair → co_occurs → witness pair (undirected)
    for (let i = 0; i < witnessIds.length; i++) {
      for (let j = i + 1; j < witnessIds.length; j++) {
        allEdges.push({
          source: witnessIds[i],
          target: witnessIds[j],
          type: "co_occurs",
        });
      }
    }

    // institution → receives → document
    for (const inst of institutions) {
      const instId = makeEntityId("institution", inst.label);
      allEdges.push({ source: instId, target: docId, type: "receives" });
    }

    // document → has_type → document_type
    if (docTypeNode) {
      const docTypeId = `doctype_${normalizeName(docTypeNode.label)}`;
      allEdges.push({ source: docId, target: docTypeId, type: "has_type" });
    }

    // document → created_in → place
    for (const place of places) {
      const placeId = makeEntityId("place", place.label);
      allEdges.push({ source: docId, target: placeId, type: "created_in" });
    }
  }

  // 4. Deduplication — Phase 1: exact normalized name + type match
  console.log("\nDeduplication Phase 1: exact name match + same type");
  const phase1Nodes = deduplicatePhase1(allRawNodes);
  console.log(
    `  Reduced from ${allRawNodes.length} to ${phase1Nodes.length} nodes`,
  );

  // 5. Deduplication — Phase 2: Levenshtein + date proximity for persons
  console.log("\nDeduplication Phase 2: Levenshtein ≤ 2 + date proximity ≤ 50 years");
  const personNodes = phase1Nodes.filter((n) => n.type === "person");
  const otherNodes = phase1Nodes.filter((n) => n.type !== "person");

  const mergedPersonIndices = new Set<number>();
  const finalPersons: PartialEntityNode[] = [];

  for (let i = 0; i < personNodes.length; i++) {
    if (mergedPersonIndices.has(i)) continue;

    const current = personNodes[i];
    const currentNorm = normalizeName(current.label);
    const currentDates = personDocDates.get(currentNorm) || [];

    let mergedNode: PartialEntityNode = {
      ...current,
      roles: current.roles ? [...current.roles] : [],
    };

    for (let j = i + 1; j < personNodes.length; j++) {
      if (mergedPersonIndices.has(j)) continue;

      const candidate = personNodes[j];
      const candidateNorm = normalizeName(candidate.label);

      const dist = levenshtein(currentNorm, candidateNorm);
      if (dist > 2) continue;

      // Check date proximity
      const candidateDates = personDocDates.get(candidateNorm) || [];
      let withinRange = false;
      for (const d1 of currentDates) {
        for (const d2 of candidateDates) {
          if (Math.abs(d1 - d2) <= 50) {
            withinRange = true;
            break;
          }
        }
        if (withinRange) break;
      }

      if (!withinRange) {
        console.log(
          `  Skipping merge: "${current.label}" ↔ "${candidate.label}" (distance: ${dist}, but dates too far apart)`,
        );
        continue;
      }

      console.log(
        `  Merging: "${current.label}" ↔ "${candidate.label}" (distance: ${dist}, dates within 50 years)`,
      );
      mergedPersonIndices.add(j);

      // Merge roles
      if (candidate.roles) {
        mergedNode.roles = mergedNode.roles
          ? [...new Set([...mergedNode.roles, ...candidate.roles])]
          : [...candidate.roles];
      }
    }

    finalPersons.push(mergedNode);
  }

  const deduplicatedNodes = [...finalPersons, ...otherNodes];
  console.log(
    `  Final node count after Phase 2: ${deduplicatedNodes.length}`,
  );

  // 6. Clan derivation
  console.log("\nDeriving clan memberships...");
  const clanMap: Map<string, { label: string; members: string[] }> = new Map();

  for (const node of deduplicatedNodes) {
    if (node.type !== "person") continue;
    const clanName = deriveClan(node.label);
    if (clanName) {
      const clanKey = normalizeName(clanName);
      if (!clanMap.has(clanKey)) {
        clanMap.set(clanKey, { label: clanName, members: [] });
      }
      clanMap.get(clanKey)!.members.push(normalizeName(node.label));
      // Store clan on the person node
      node.clan = clanName;
    }
  }

  // Create clan nodes and belongs_to_clan edges
  const clanNodes: EntityNode[] = [];
  for (const [clanKey, clanInfo] of clanMap) {
    const clanId = `clan_${clanKey}`;
    clanNodes.push({
      id: clanId,
      type: "clan",
      label: clanInfo.label,
      memberCount: clanInfo.members.length,
    });

    // Add belongs_to_clan edges for each member
    for (const memberNorm of clanInfo.members) {
      const personId = `person_${memberNorm}`;
      allEdges.push({
        source: personId,
        target: clanId,
        type: "belongs_to_clan",
      });
    }
  }

  console.log(`  Found ${clanNodes.length} unique clans`);

  // 7. Build final EntityNode array with proper IDs
  const finalNodes: EntityNode[] = [];

  for (const node of deduplicatedNodes) {
    let id: string;
    if (node.type === "document") {
      id = node.fileId || normalizeName(node.label);
    } else if (node.type === "document_type") {
      id = `doctype_${normalizeName(node.label)}`;
    } else if (node.type === "clan") {
      // Already handled above
      continue;
    } else {
      id = makeEntityId(node.type, node.label);
    }

    const entityNode: EntityNode = {
      id,
      type: node.type,
      label: node.label,
    };

    if (node.roles && node.roles.length > 0) entityNode.roles = node.roles;
    if (node.clan) entityNode.clan = node.clan;
    if (node.date) entityNode.date = node.date;
    if (node.docType) entityNode.docType = node.docType;
    if (node.archive) entityNode.archive = node.archive;
    if (node.fileId) entityNode.fileId = node.fileId;
    if (node.instType) entityNode.instType = node.instType;

    finalNodes.push(entityNode);
  }

  // Add clan nodes
  finalNodes.push(...clanNodes);

  // 8. Deduplicate edges (remove duplicates)
  const edgeSet = new Set<string>();
  const uniqueEdges: EntityEdge[] = [];
  for (const edge of allEdges) {
    const key = `${edge.source}|${edge.target}|${edge.type}`;
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      uniqueEdges.push(edge);
    }
  }

  // 9. Build output
  const graph: EntityGraph = {
    nodes: finalNodes,
    edges: uniqueEdges,
  };

  // 10. Ensure output directory exists and write JSON
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(graph, null, 2), "utf-8");
  console.log(`\nWrote entity graph to ${OUTPUT_FILE}`);
  console.log(`  Nodes: ${finalNodes.length}`);
  console.log(`  Edges: ${uniqueEdges.length}`);

  // Summary by type
  const typeCounts: Record<string, number> = {};
  for (const node of finalNodes) {
    typeCounts[node.type] = (typeCounts[node.type] || 0) + 1;
  }
  console.log("  Node types:", typeCounts);
}

main();
