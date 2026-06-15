#!/usr/bin/env tsx
/**
 * migrate-to-p5.ts
 * Migrate data/corpus/*.xml from CEI2TEI (diploPart-based) to TEI P5.
 *
 * Run via: npx tsx scripts/migrate-to-p5.ts
 */
import * as fs from "fs";
import * as path from "path";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface TransformCounts {
  T1_diploPart_to_ab: number;
  T2_remove_p_wrapper: number;
  T3_listWitness_to_listPerson: number;
  T4_witness_to_person: number;
  T5_name_to_persName: number;
  T6_term_to_placeName: number;
  T7_remove_recipient: number;
  T8_intitulatio_to_author: number;
  T9_remove_inscriptio: number;
  T10_populate_publicationStmt: number;
  T11_fix_subtype_spaces: number;
}

function zeroCounts(): TransformCounts {
  return {
    T1_diploPart_to_ab: 0,
    T2_remove_p_wrapper: 0,
    T3_listWitness_to_listPerson: 0,
    T4_witness_to_person: 0,
    T5_name_to_persName: 0,
    T6_term_to_placeName: 0,
    T7_remove_recipient: 0,
    T8_intitulatio_to_author: 0,
    T9_remove_inscriptio: 0,
    T10_populate_publicationStmt: 0,
    T11_fix_subtype_spaces: 0,
  };
}

/** Collect all elements matching a tag name (non-namespace-aware, like xmldom). */
function getAllByTag(doc: Document, tag: string): Element[] {
  return Array.from(doc.getElementsByTagName(tag));
}

/**
 * Rename an element: create a new element with `newName`, copy all attributes
 * and children, then replace the old node in its parent.
 */
function renameElement(
  doc: Document,
  oldEl: Element,
  newName: string,
  additionalAttrs?: Record<string, string>,
  removeAttrs?: string[],
): Element {
  const newEl = doc.createElement(newName);

  // Copy existing attributes
  for (let i = 0; i < oldEl.attributes.length; i++) {
    const attr = oldEl.attributes.item(i)!;
    if (removeAttrs && removeAttrs.includes(attr.name)) continue;
    newEl.setAttribute(attr.name, attr.value);
  }

  // Set additional attributes
  if (additionalAttrs) {
    for (const [k, v] of Object.entries(additionalAttrs)) {
      newEl.setAttribute(k, v);
    }
  }

  // Move all children (including text nodes)
  while (oldEl.firstChild) {
    newEl.appendChild(oldEl.firstChild);
  }

  // Replace in parent
  oldEl.parentNode!.replaceChild(newEl, oldEl);
  return newEl;
}

/** Remove a child element from its parent, preserving its children if desired. */
function removeElement(el: Element, preserveChildren = false): void {
  if (preserveChildren) {
    while (el.firstChild) {
      el.parentNode!.insertBefore(el.firstChild, el);
    }
  }
  el.parentNode!.removeChild(el);
}

// ---------------------------------------------------------------------------
// Transformations
// ---------------------------------------------------------------------------

/** T1: Rename <diploPart> to <ab> */
function t1_diploPartToAb(doc: Document): number {
  let count = 0;
  // Must iterate carefully since we're mutating the DOM
  const els = getAllByTag(doc, "diploPart");
  // Process in reverse since renameElement doesn't affect getElementsByTagName
  // (it returns a live list but we snapshot it)
  for (let i = els.length - 1; i >= 0; i--) {
    renameElement(doc, els[i], "ab");
    count++;
  }
  return count;
}

/** T2: Remove <p> wrapper inside <ab> (move children up, remove <p>) */
function t2_removePWrapper(doc: Document): number {
  let count = 0;
  const abs = getAllByTag(doc, "ab");
  for (const ab of Array.from(abs)) {
    // Get <p> direct children of <ab>
    const pChildren: Element[] = [];
    for (let i = 0; i < ab.childNodes.length; i++) {
      const child = ab.childNodes[i];
      if (child.nodeType === 1 && (child as Element).nodeName === "p") {
        pChildren.push(child as Element);
      }
    }
    for (const p of pChildren) {
      // Move all children of <p> to be before <p> in <ab>
      while (p.firstChild) {
        ab.insertBefore(p.firstChild, p);
      }
      ab.removeChild(p);
      count++;
    }
  }
  return count;
}

/** T3: Rename <listWitness> to <listPerson> */
function t3_listWitnessToListPerson(doc: Document): number {
  let count = 0;
  const els = getAllByTag(doc, "listWitness");
  for (let i = els.length - 1; i >= 0; i--) {
    renameElement(doc, els[i], "listPerson");
    count++;
  }
  return count;
}

/** T4: Rename <witness> to <person> with @role */
function t4_witnessToPerson(doc: Document): number {
  let count = 0;
  const els = getAllByTag(doc, "witness");
  for (let i = els.length - 1; i >= 0; i--) {
    const w = els[i];
    const ana = w.getAttribute("ana");
    if (ana === "#investitor") {
      renameElement(doc, w, "person", { role: "issuer" }, ["ana"]);
    } else {
      renameElement(doc, w, "person", { role: "witness" });
    }
    count++;
  }
  return count;
}

/** T5: Replace <name> with <persName> in person and respStmt contexts */
function t5_nameToPersName(doc: Document): number {
  let count = 0;

  // Collect contexts where <name> should become <persName>
  const personEls = getAllByTag(doc, "person");
  const respStmtEls = getAllByTag(doc, "respStmt");

  // Also find <ab type="subscriptio"> elements
  const abEls = getAllByTag(doc, "ab");
  const subscriptioAbs: Element[] = [];
  for (const ab of abEls) {
    if (ab.getAttribute("type") === "subscriptio") {
      subscriptioAbs.push(ab);
    }
  }

  const contexts: Element[] = [...personEls, ...respStmtEls, ...subscriptioAbs];

  // Process each context's <name> children
  for (const ctx of contexts) {
    const nameEls: Element[] = [];
    // Recursively find <name> descendants (not just direct children)
    const names = ctx.getElementsByTagName("name");
    for (let i = 0; i < names.length; i++) {
      nameEls.push(names[i]);
    }
    for (let i = nameEls.length - 1; i >= 0; i--) {
      renameElement(doc, nameEls[i], "persName");
      count++;
    }
  }
  return count;
}

/** T6: Replace <term type="datatio_topica_analysis"> with <placeName> in <creation> */
function t6_termToPlaceName(doc: Document): number {
  let count = 0;
  const creations = getAllByTag(doc, "creation");
  for (const creation of creations) {
    const terms = creation.getElementsByTagName("term");
    const toRename: Element[] = [];
    for (let i = 0; i < terms.length; i++) {
      const t = terms[i];
      if (t.getAttribute("type") === "datatio_topica_analysis") {
        toRename.push(t);
      }
    }
    for (const t of toRename) {
      renameElement(doc, t, "placeName", { type: "datatio_topica_analysis" });
      count++;
    }
  }
  return count;
}

/** T7: Remove <recipient> from <msItem> (remove entirely, including children) */
function t7_removeRecipient(doc: Document): number {
  let count = 0;
  const msItems = getAllByTag(doc, "msItem");
  for (const msItem of msItems) {
    const recipients: Element[] = [];
    for (let i = 0; i < msItem.childNodes.length; i++) {
      const child = msItem.childNodes[i];
      if (child.nodeType === 1 && (child as Element).nodeName === "recipient") {
        recipients.push(child as Element);
      }
    }
    for (const r of recipients) {
      removeElement(r, false); // remove entirely, do not preserve children
      count++;
    }
  }
  return count;
}

/** T8: Move <term type="intitulatio_analysis"> from <keywords> to <titleStmt> as <author> */
function t8_intitulatioToAuthor(doc: Document): number {
  let count = 0;
  const keywords = getAllByTag(doc, "keywords");
  for (const kw of keywords) {
    const terms = kw.getElementsByTagName("term");
    const toProcess: Element[] = [];
    for (let i = 0; i < terms.length; i++) {
      if (terms[i].getAttribute("type") === "intitulatio_analysis") {
        toProcess.push(terms[i]);
      }
    }
    for (const term of toProcess) {
      const value = term.textContent || "";
      // Find titleStmt
      const titleStmts = getAllByTag(doc, "titleStmt");
      if (titleStmts.length === 0) {
        console.warn("    T8: No <titleStmt> found, skipping");
        continue;
      }
      const titleStmt = titleStmts[0];
      // Remove existing <author> elements in titleStmt to avoid duplicates
      const existingAuthors: Element[] = [];
      for (let i = 0; i < titleStmt.childNodes.length; i++) {
        const child = titleStmt.childNodes[i];
        if (child.nodeType === 1 && (child as Element).nodeName === "author") {
          existingAuthors.push(child as Element);
        }
      }
      for (const existing of existingAuthors) {
        titleStmt.removeChild(existing);
      }
      // Create <author role="issuer"><persName>VALUE</persName></author>
      const author = doc.createElement("author");
      author.setAttribute("role", "issuer");
      const persName = doc.createElement("persName");
      persName.textContent = value;
      author.appendChild(persName);
      // Insert after <title> if present, otherwise at end
      const title = titleStmt.getElementsByTagName("title")[0];
      if (title && title.nextSibling) {
        titleStmt.insertBefore(author, title.nextSibling);
      } else {
        titleStmt.appendChild(author);
      }
      // Remove original term
      term.parentNode!.removeChild(term);
      count++;
    }
  }
  return count;
}

/** T9: Remove <term type="inscriptio_analysis"> from <keywords> */
function t9_removeInscriptio(doc: Document): number {
  let count = 0;
  const keywords = getAllByTag(doc, "keywords");
  for (const kw of keywords) {
    const terms = kw.getElementsByTagName("term");
    const toRemove: Element[] = [];
    for (let i = 0; i < terms.length; i++) {
      if (terms[i].getAttribute("type") === "inscriptio_analysis") {
        toRemove.push(terms[i]);
      }
    }
    for (const t of toRemove) {
      t.parentNode!.removeChild(t);
      count++;
    }
  }
  return count;
}

/** T10: Populate <publicationStmt> if empty */
function t10_populatePublicationStmt(doc: Document): number {
  let count = 0;
  const pubStmts = getAllByTag(doc, "publicationStmt");
  for (const ps of pubStmts) {
    // Check if there's a single <p> child with no text content
    const pChildren: Element[] = [];
    for (let i = 0; i < ps.childNodes.length; i++) {
      const child = ps.childNodes[i];
      if (child.nodeType === 1 && (child as Element).nodeName === "p") {
        pChildren.push(child as Element);
      }
    }
    if (pChildren.length === 1) {
      const p = pChildren[0];
      const text = (p.textContent || "").trim();
      if (text === "") {
        p.textContent = "Encoded by Sema TEI Corpus Explorer";
        count++;
      }
    }
  }
  return count;
}

/** T11: Fix @subtype values with spaces → underscores (TEI teidata.word compliance) */
function t11_fixSubtypeSpaces(doc: Document): number {
  let count = 0;
  const allElements = doc.getElementsByTagName("*");
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i] as Element;
    if (el.hasAttribute && el.hasAttribute("subtype")) {
      const val = el.getAttribute("subtype") || "";
      if (val.includes(" ")) {
        const fixed = val.replace(/\s+/g, "_");
        el.setAttribute("subtype", fixed);
        count++;
      }
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function processFile(filePath: string): TransformCounts {
  const counts = zeroCounts();
  const fileName = path.basename(filePath);

  let xmlContent: string;
  try {
    xmlContent = fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    console.warn(`  Warning: Could not read ${fileName}: ${err}`);
    return counts;
  }

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xmlContent, "text/xml");
  } catch (err) {
    console.warn(`  Warning: XML parse error in ${fileName}: ${err}`);
    return counts;
  }

  // Check for parse errors
  const parseError = doc.getElementsByTagName("parsererror");
  if (parseError.length > 0) {
    const errorText = parseError[0].textContent || "unknown parse error";
    console.warn(`  Warning: XML parse error in ${fileName}: ${errorText}`);
    return counts;
  }

  // Apply transformations in order
  try { counts.T1_diploPart_to_ab = t1_diploPartToAb(doc); } catch (e) { console.warn(`  T1 failed in ${fileName}: ${e}`); }
  try { counts.T2_remove_p_wrapper = t2_removePWrapper(doc); } catch (e) { console.warn(`  T2 failed in ${fileName}: ${e}`); }
  try { counts.T3_listWitness_to_listPerson = t3_listWitnessToListPerson(doc); } catch (e) { console.warn(`  T3 failed in ${fileName}: ${e}`); }
  try { counts.T4_witness_to_person = t4_witnessToPerson(doc); } catch (e) { console.warn(`  T4 failed in ${fileName}: ${e}`); }
  try { counts.T5_name_to_persName = t5_nameToPersName(doc); } catch (e) { console.warn(`  T5 failed in ${fileName}: ${e}`); }
  try { counts.T6_term_to_placeName = t6_termToPlaceName(doc); } catch (e) { console.warn(`  T6 failed in ${fileName}: ${e}`); }
  try { counts.T7_remove_recipient = t7_removeRecipient(doc); } catch (e) { console.warn(`  T7 failed in ${fileName}: ${e}`); }
  try { counts.T8_intitulatio_to_author = t8_intitulatioToAuthor(doc); } catch (e) { console.warn(`  T8 failed in ${fileName}: ${e}`); }
  try { counts.T9_remove_inscriptio = t9_removeInscriptio(doc); } catch (e) { console.warn(`  T9 failed in ${fileName}: ${e}`); }
  try { counts.T10_populate_publicationStmt = t10_populatePublicationStmt(doc); } catch (e) { console.warn(`  T10 failed in ${fileName}: ${e}`); }
  try { counts.T11_fix_subtype_spaces = t11_fixSubtypeSpaces(doc); } catch (e) { console.warn(`  T11 failed in ${fileName}: ${e}`); }

  // Serialize and write back
  const serializer = new XMLSerializer();
  let output = serializer.serializeToString(doc);

  // Ensure XML declaration is present
  if (!output.startsWith("<?xml")) {
    output = '<?xml version="1.0" encoding="UTF-8"?>\n' + output;
  }

  fs.writeFileSync(filePath, output, "utf-8");

  // Print per-file summary
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total > 0) {
    const details = Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${k.replace(/^T\d+_/, "")}: ${v}`)
      .join(", ");
    console.log(`  ${fileName}: ${total} transform(s) — ${details}`);
  } else {
    console.log(`  ${fileName}: no transforms needed (already P5?)`);
  }

  return counts;
}

function main() {
  const corpusDir = path.resolve(__dirname, "..", "data", "corpus");

  if (!fs.existsSync(corpusDir)) {
    console.error(`Corpus directory not found: ${corpusDir}`);
    process.exit(1);
  }

  const xmlFiles = fs
    .readdirSync(corpusDir)
    .filter((f) => f.endsWith(".xml"))
    .map((f) => path.join(corpusDir, f))
    .sort();

  if (xmlFiles.length === 0) {
    console.warn("No XML files found in data/corpus/");
    process.exit(0);
  }

  console.log(`Found ${xmlFiles.length} XML file(s) in ${corpusDir}\n`);

  const totals = zeroCounts();
  let processed = 0;
  let failed = 0;

  for (const xmlFile of xmlFiles) {
    try {
      const counts = processFile(xmlFile);
      // Accumulate totals
      for (const key of Object.keys(totals) as (keyof TransformCounts)[]) {
        totals[key] += counts[key];
      }
      processed++;
    } catch (err) {
      console.error(`  Error processing ${path.basename(xmlFile)}: ${err}`);
      failed++;
    }
  }

  // Print final summary
  console.log("\n=== Migration Summary ===");
  console.log(`Files processed: ${processed}`);
  if (failed > 0) console.log(`Files failed:    ${failed}`);
  console.log(`\nTransform counts:`);
  for (const [key, value] of Object.entries(totals)) {
    const label = key.replace(/^T\d+_/, "").replace(/_/g, " ");
    console.log(`  ${key}: ${value} (${label})`);
  }
  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);
  console.log(`\nTotal transforms applied: ${grandTotal}`);
}

main();
