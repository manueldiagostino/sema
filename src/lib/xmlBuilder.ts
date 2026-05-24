import type {
  FormSubmissionData,
  FormSectionsConfig,
  FormFieldConfig,
  DateFieldValue,
} from "@/types/form";

/** Escape special XML characters in text content. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Build an XML attribute string from a record. */
function attr(a?: Record<string, string>): string {
  if (!a) return "";
  return Object.entries(a)
    .map(([k, v]) => ` ${k}="${esc(v)}"`)
    .join("");
}

/** Check if a value is empty / null / blank string. */
function isEmpty(v: unknown): boolean {
  return v == null || (typeof v === "string" && v.trim() === "");
}

/** Shorthand to read a field value from submission data. */
function getVal(data: FormSubmissionData, id: string) {
  return data.fields[id];
}

/**
 * Generate simple single-line TEI elements for a set of fields.
 * Skips date fields (handled separately) and empty values.
 * Handles cardinality: multiple by emitting one element per value.
 */
function genSimpleElements(
  data: FormSubmissionData,
  fields: FormFieldConfig[],
  indent: string,
): string {
  const lines: string[] = [];
  for (const f of fields) {
    if (f.input === "date") continue;
    const v = getVal(data, f.id);
    if (isEmpty(v)) continue;

    const a = attr(f.tei_attributes);

    if (f.cardinality === "multiple" && Array.isArray(v)) {
      for (const item of v) {
        if (!isEmpty(item)) {
          lines.push(
            `${indent}<${f.tei_element}${a}>${esc(item)}</${f.tei_element}>`,
          );
        }
      }
    } else if (typeof v === "string") {
      lines.push(
        `${indent}<${f.tei_element}${a}>${esc(v)}</${f.tei_element}>`,
      );
    }
  }
  return lines.join("\n");
}

/**
 * Main function that generates the complete TEI P5 XML document
 * from form submission data and the form section configuration.
 */
export function generateTeiXml(
  data: FormSubmissionData,
  config: FormSectionsConfig,
): string {
  // Collect all fields grouped by xpath_parent
  const byParent = new Map<string, FormFieldConfig[]>();
  for (const section of config.sections) {
    for (const f of section.fields) {
      if (!byParent.has(f.xpath_parent)) byParent.set(f.xpath_parent, []);
      byParent.get(f.xpath_parent)!.push(f);
    }
  }

  const fields = (path: string) => byParent.get(path) || [];

  // ── titleStmt (title, author) ──
  const titleStmtContent = genSimpleElements(
    data,
    fields("tei:teiHeader/tei:fileDesc/tei:titleStmt"),
    "        ",
  );

  // ── msIdentifier (country, settlement, repository, idno) ──
  const msIdContent = genSimpleElements(
    data,
    fields(
      "tei:teiHeader/tei:fileDesc/tei:sourceDesc/tei:msDesc/tei:msIdentifier",
    ),
    "            ",
  );

  // ── msItem (recipient + notary as respStmt) ──
  const msItemLines: string[] = [];
  const msItemFields = fields(
    "tei:teiHeader/tei:fileDesc/tei:sourceDesc/tei:msDesc/tei:msContents/tei:msItem",
  );
  for (const f of msItemFields) {
    if (f.id === "notary") continue;
    const v = getVal(data, f.id);
    if (!isEmpty(v) && typeof v === "string") {
      msItemLines.push(
        `              <${f.tei_element}>${esc(v)}</${f.tei_element}>`,
      );
    }
  }
  // Notary → special respStmt wrapper
  const notaryVal = getVal(data, "notary");
  if (!isEmpty(notaryVal) && typeof notaryVal === "string") {
    msItemLines.push(
      `              <respStmt>\n` +
        `                <resp>notary</resp>\n` +
        `                <name>${esc(notaryVal)}</name>\n` +
        `              </respStmt>`,
    );
  }
  const msItemContent = msItemLines.join("\n");

  // ── creation (date + origPlace) ──
  const creationLines: string[] = [];
  const dateVal = getVal(data, "date");
  if (dateVal && typeof dateVal === "object" && "iso" in dateVal) {
    const dv = dateVal as DateFieldValue;
    const text = dv.text || dv.iso;
    if (!isEmpty(dv.iso) || !isEmpty(text)) {
      creationLines.push(
        `        <date when="${esc(dv.iso)}">${esc(text)}</date>`,
      );
    }
  }
  const origPlaceFields = fields(
    "tei:teiHeader/tei:profileDesc/tei:creation",
  ).filter((f) => f.id !== "date");
  const origPlaceContent = genSimpleElements(data, origPlaceFields, "        ");
  if (origPlaceContent) creationLines.push(origPlaceContent);
  const creationContent = creationLines.join("\n");

  // ── langUsage (language with @ident) ──
  const langFields = fields("tei:teiHeader/tei:profileDesc/tei:langUsage");
  const langLines: string[] = [];
  for (const f of langFields) {
    const v = getVal(data, f.id);
    if (!isEmpty(v) && typeof v === "string") {
      const a = attr(f.tei_attributes);
      langLines.push(
        `        <${f.tei_element}${a}>${esc(v)}</${f.tei_element}>`,
      );
    }
  }
  const langContent = langLines.join("\n");

  // ── keywords (terms + ad-hoc) ──
  const kwFields = fields(
    "tei:teiHeader/tei:profileDesc/tei:textClass/tei:keywords",
  );
  const kwLines: string[] = [];
  for (const f of kwFields) {
    const v = getVal(data, f.id);
    if (isEmpty(v)) continue;
    const a = attr(f.tei_attributes);
    if (f.cardinality === "multiple" && Array.isArray(v)) {
      for (const item of v) {
        if (!isEmpty(item))
          kwLines.push(`          <term${a}>${esc(item)}</term>`);
      }
    } else if (typeof v === "string") {
      kwLines.push(`          <term${a}>${esc(v)}</term>`);
    }
  }
  // Ad-hoc fields → <term type="key">value</term>
  for (const ah of data.ad_hoc || []) {
    if (!isEmpty(ah.key) && !isEmpty(ah.value)) {
      kwLines.push(
        `          <term type="${esc(ah.key)}">${esc(ah.value)}</term>`,
      );
    }
  }
  const kwContent = kwLines.join("\n");

  // ── body (div wrappers: price_clause, penalty_clause) ──
  const bodyFields = fields("tei:text/tei:body");
  const bodyLines: string[] = [];
  for (const f of bodyFields) {
    const v = getVal(data, f.id);
    if (isEmpty(v) || typeof v !== "string") continue;
    const type = f.tei_wrapper_attributes?.type || "";
    bodyLines.push(
      `      <div type="${esc(type)}">\n` +
        `        <p>${esc(v)}</p>\n` +
        `      </div>`,
    );
  }
  const bodyContent = bodyLines.join("\n");

  // ── listWitness ──
  const witnessFields = fields("tei:text/tei:body/tei:listWitness");
  const witnessLines: string[] = [];
  for (const f of witnessFields) {
    const v = getVal(data, f.id);
    if (isEmpty(v)) continue;
    if (f.cardinality === "multiple" && Array.isArray(v)) {
      for (const item of v) {
        if (!isEmpty(item)) {
          witnessLines.push(
            `        <witness><name>${esc(item)}</name></witness>`,
          );
        }
      }
    } else if (typeof v === "string") {
      witnessLines.push(
        `        <witness><name>${esc(v)}</name></witness>`,
      );
    }
  }
  const witnessContent = witnessLines.join("\n");

  // ── Assemble the full document ──
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<?xml-model href="http://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_all.rng" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"?>',
    '<TEI xmlns="http://www.tei-c.org/ns/1.0">',
    "  <teiHeader>",
    "    <fileDesc>",
    "      <titleStmt>",
    ...(titleStmtContent ? titleStmtContent.split("\n") : []),
    "      </titleStmt>",
    "      <publicationStmt>",
    "        <p>Sample CEI2TEI P5 document for testing corpus table configuration</p>",
    "      </publicationStmt>",
    "      <sourceDesc>",
    "        <msDesc>",
    "          <msIdentifier>",
    ...(msIdContent ? msIdContent.split("\n") : []),
    "          </msIdentifier>",
    "          <msContents>",
    "            <msItem>",
    ...(msItemContent ? msItemContent.split("\n") : []),
    "            </msItem>",
    "          </msContents>",
    "          <physDesc>",
    "            <objectDesc>",
    "              <supportDesc>",
    "                <support>parchment</support>",
    "              </supportDesc>",
    "            </objectDesc>",
    "          </physDesc>",
    "        </msDesc>",
    "      </sourceDesc>",
    "    </fileDesc>",
    "    <profileDesc>",
    "      <creation>",
    ...(creationContent ? creationContent.split("\n") : []),
    "      </creation>",
    "      <langUsage>",
    ...(langContent ? langContent.split("\n") : []),
    "      </langUsage>",
    "      <textClass>",
    "        <keywords>",
    ...(kwContent ? kwContent.split("\n") : []),
    "        </keywords>",
    "      </textClass>",
    "    </profileDesc>",
    "  </teiHeader>",
    "  <text>",
    "    <body>",
    ...(bodyContent ? bodyContent.split("\n") : []),
    "      <listWitness>",
    ...(witnessContent ? witnessContent.split("\n") : []),
    "      </listWitness>",
    "    </body>",
    "  </text>",
    "</TEI>",
  ];

  return lines.join("\n");
}

/**
 * Generates a filename like `emphyteusis_1318.xml` from the charter type and date.
 * Format: <type_id>_<year>.xml
 */
export function buildFilename(data: FormSubmissionData): string {
  const charterType = data.charter_type || "unknown";
  const dateVal = getVal(data, "date");

  let year = "unknown";
  if (
    dateVal &&
    typeof dateVal === "object" &&
    "iso" in dateVal &&
    typeof (dateVal as DateFieldValue).iso === "string"
  ) {
    const iso = (dateVal as DateFieldValue).iso;
    const match = iso.match(/^(\d{4})/);
    if (match) year = match[1];
  }

  return `${charterType}_${year}.xml`;
}
