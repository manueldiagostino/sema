import type {
  FormSubmissionData,
  WitnessEntry,
  PlaceEntry,
  DateFieldValue,
} from "@/types/form";
import type {
  TeiSchema,
  FormViewConfig,
  FormSection,
  FormField,
} from "@/types/schema";
import { serializeFieldElements } from "@/lib/schema/serialize";

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
  if (v == null) return true;
  if (typeof v === "string") return v.trim() === "";
  return false;
}

/** Shorthand to read a field value from submission data. */
function getVal(data: FormSubmissionData, id: string) {
  return data.fields[id];
}

/** Get a field value as string, or empty string if missing. */
function getStr(data: FormSubmissionData, id: string): string {
  const v = getVal(data, id);
  return typeof v === "string" ? v : "";
}

/** Get WitnessEntry[] value, or empty array. */
function getWitnesses(data: FormSubmissionData, id: string): WitnessEntry[] {
  const v = getVal(data, id);
  if (Array.isArray(v) && v.length > 0 && v[0] && typeof v[0] === "object" && "name" in v[0]) {
    return v as WitnessEntry[];
  }
  return [];
}

/** Get PlaceEntry[] value, or empty array. */
function getPlaceEntries(
  data: FormSubmissionData,
  fieldName: string,
): PlaceEntry[] {
  const val = data.fields[fieldName];
  if (Array.isArray(val) && val.length > 0 && typeof val[0] === "object" && "name" in val[0]) {
    return val as PlaceEntry[];
  }
  return [];
}

/**
 * Build an <ab> element with optional @subtype.
 * Returns empty string if textContent is empty.
 */
function makeAb(
  type: string,
  textContent: string,
  subtype?: string,
  indent = "        ",
): string {
  if (isEmpty(textContent)) return "";
  const subtypeAttr = subtype ? ` subtype="${esc(subtype)}"` : "";
  return `${indent}<ab type="${esc(type)}"${subtypeAttr}>${esc(textContent)}</ab>`;
}

/**
 * Build a div with optional @subtype but without <p> child (container only).
 */
function makeDivContainer(
  type: string,
  children: string[],
  subtype?: string,
  indent = "      ",
): string {
  const subtypeAttr = subtype ? ` subtype="${esc(subtype)}"` : "";
  const childLines = children.filter((c) => c).map((c) => c);
  if (childLines.length === 0) return "";
  return (
    `${indent}<div type="${esc(type)}"${subtypeAttr}>\n` +
    childLines.join("\n") +
    `\n${indent}</div>`
  );
}

/**
 * Derive a short charter code from a charter type ID.
 * Multi-word IDs (underscore-separated): first letter of each word.
 * Single-word IDs: first two letters.
 */
export function deriveCharterCode(typeId: string): string {
  const parts = typeId.split("_");
  if (parts.length >= 2) {
    return parts.map((p) => p[0]).join("").toLowerCase();
  }
  return typeId.slice(0, 2).toLowerCase();
}

/** Check whether a field's TEI element maps to the body section (not teiHeader). */
function isBodyField(fieldId: string, schema: TeiSchema): boolean {
  const elem = schema.elements[fieldId];
  if (!elem) return false;
  return elem.tei.xpath_parent.startsWith("tei:text/tei:body");
}

/**
 * Collect all FormField entries from a section tree (including subsections)
 * in declaration order (section fields first, then subsection fields).
 */
function collectSectionFields(section: FormSection): FormField[] {
  const fields: FormField[] = [...(section.fields || [])];
  for (const sub of section.subsections || []) {
    fields.push(...collectSectionFields(sub));
  }
  return fields;
}

/**
 * Build an indented XML string from the serializer output and field metadata.
 * Applies the appropriate indentation for the nesting level.
 */
function indentXml(xml: string, level: number): string {
  const pad = "  ".repeat(level);
  // If multi-line, indent each line
  if (xml.includes("\n")) {
    return xml
      .split("\n")
      .map((line) => (line.trim() ? pad + line : line))
      .join("\n");
  }
  return pad + xml;
}

/**
 * Generate the complete TEI P5 XML document from form submission data.
 * Builds a diplomatic formulary with optional full text div.
 * @param formConfig The merged form view config (server-loaded via loadFormConfig)
 * @param schema The TEI schema registry (server-loaded via loadTeiSchema)
 * @param docId Optional document ID (filename stem) for xml:id on <TEI> root.
 */
export function generateTeiXml(
  data: FormSubmissionData,
  charterTypes: Array<{ id: string; label: string; object_value?: string; object_subtype_value?: string }>,
  formConfig: FormViewConfig,
  schema: TeiSchema,
  docId?: string,
): string {
  const I = (n: number) => "  ".repeat(n); // indentation helper

  // Look up charter type config
  const charterTypeConfig = charterTypes.find((t) => t.id === data.charter_type);

  // ── teiHeader lines ──

  // titleStmt
  const authorName = getStr(data, "intitulatio_analysis");
  const titleStmt: string[] = [];
  titleStmt.push(`${I(4)}<title>${esc(charterTypeConfig?.label || data.charter_type)}</title>`);
  if (authorName) {
    titleStmt.push(`${I(4)}<author role="issuer"><persName>${esc(authorName)}</persName></author>`);
  }

  // msIdentifier
  const repository = getStr(data, "repository");
  const shelfmark = getStr(data, "shelfmark");
  const msId: string[] = [];
  if (repository) msId.push(`${I(6)}<repository>${esc(repository)}</repository>`);
  if (shelfmark) msId.push(`${I(6)}<idno>${esc(shelfmark)}</idno>`);

  // msItem
  const notaryName = getStr(data, "completio_analysis");
  const msItem: string[] = [];
  if (notaryName) {
    msItem.push(
      `${I(7)}<respStmt>\n` +
        `${I(8)}<resp>notary</resp>\n` +
        `${I(8)}<persName type="completio_analysis">${esc(notaryName)}</persName>\n` +
        `${I(7)}</respStmt>`,
    );
  }

  // creation
  const dateVal = getVal(data, "datatio_chronica_analysis");
  const locusRedactionis = getPlaceEntries(data, "datatio_topica_analysis");
  const creation: string[] = [];
  if (dateVal && typeof dateVal === "object" && "iso" in dateVal) {
    const dv = dateVal as DateFieldValue;
    const text = dv.iso;
    if (!isEmpty(dv.iso) || !isEmpty(text)) {
      creation.push(
        `${I(4)}<date when="${esc(dv.iso)}">${esc(text)}</date>`,
      );
    }
  }
  for (const place of locusRedactionis) {
    if (isEmpty(place.name)) continue;
    if (place.level) {
      creation.push(
        `${I(4)}<placeName type="datatio_topica_analysis" subtype="${esc(place.level)}">${esc(place.name)}</placeName>`,
      );
    } else {
      creation.push(
        `${I(4)}<placeName type="datatio_topica_analysis">${esc(place.name)}</placeName>`,
      );
    }
  }

  // keywords
  const kwFields: [string, string][] = [
    ["pretium", "price"],
    ["property_location", "property_location"],
    ["datatio_topica_analysis", "datatio_topica_analysis"],
    ["subscriptio_emittentis_analysis", "subscriptio_emittentis_analysis"],
  ];
  const kwTerms: string[] = [];
  if (charterTypeConfig?.object_value) {
    kwTerms.push(`${I(5)}<term type="object">${esc(charterTypeConfig.object_value)}</term>`);
  }
  if (charterTypeConfig?.object_subtype_value) {
    kwTerms.push(`${I(5)}<term type="object_subtype">${esc(charterTypeConfig.object_subtype_value)}</term>`);
  }
  for (const [fieldId, termType] of kwFields) {
    const v = getStr(data, fieldId);
    if (v) kwTerms.push(`${I(5)}<term type="${esc(termType)}">${esc(v)}</term>`);
  }
  // ad-hoc
  for (const ah of data.ad_hoc || []) {
    if (!isEmpty(ah.key) && !isEmpty(ah.value)) {
      kwTerms.push(`${I(5)}<term type="${esc(ah.key)}">${esc(ah.value)}</term>`);
    }
  }

  // ── body: schema-driven serialization ──

  // Build a map of body-relevant field pairs (both fields are body elements)
  const bodyPairMap = new Map<
    string,
    { text?: string; analysis?: string }
  >();
  for (const [fieldId, elem] of Object.entries(schema.elements)) {
    if (!elem.field_pair) continue;
    if (!isBodyField(fieldId, schema)) continue;
    const group = bodyPairMap.get(elem.field_pair) || {};
    if (
      elem.type === "text" ||
      elem.type === "identifier" ||
      elem.type === "number"
    ) {
      group.text = fieldId;
    } else {
      group.analysis = fieldId;
    }
    bodyPairMap.set(elem.field_pair, group);
  }

  // Serialize a single form field, handling field_pair merging.
  // Returns indented XML fragment lines.
  function serializeBodyField(
    field: FormField,
    indentSpaces: number,
  ): string[] {
    const fieldId = field.id;
    const elem = schema.elements[fieldId];
    if (!elem) return [];

    const pairName = field.field_pair;
    const pairInfo = pairName ? bodyPairMap.get(pairName) : undefined;

    // If this is the text field of a pair with an analysis field, skip.
    // The analysis field will serialize with pairedText instead.
    if (pairInfo?.text === fieldId && pairInfo.analysis) return [];

    // If this is the analysis field of a pair, serialize with paired text
    if (pairInfo?.analysis === fieldId && pairInfo.text) {
      const pairedText = getStr(data, pairInfo.text);
      const fragments = serializeFieldElements(elem, getVal(data, fieldId), {
        pairedText,
      });
      return fragments.map((f) => " ".repeat(indentSpaces) + f);
    }

    // Standalone field
    const fragments = serializeFieldElements(elem, getVal(data, fieldId));
    return fragments.map((f) => " ".repeat(indentSpaces) + f);
  }

  // Full text element (positioned before protocol, if present)
  const fullTextContent = getStr(data, "full_text");
  let fullTextDiv = "";
  if (fullTextContent) {
    fullTextDiv = makeAb("full_text", fullTextContent, undefined, "      ");
  }
  const bodyContent: string[] = fullTextDiv ? [fullTextDiv] : [];

  // Find the formulary tab in the form config
  const formularyTab = formConfig.tabs.items.find((tab) =>
    tab.sections?.some(
      (s) => s.id === "protocol" || s.id === "text" || s.id === "eschatocol",
    ),
  );

  if (formularyTab) {
    // Track processed field pairs to avoid double-output across sections
    const processedPairs = new Set<string>();

    for (const section of formularyTab.sections || []) {
      const sectionId = section.id;

      let divType: string | null = null;
      if (sectionId === "protocol") divType = "protocol";
      else if (sectionId === "text") divType = "contextus";
      else if (sectionId === "eschatocol") divType = "eschatocol";
      if (!divType) continue;

      const sectionChildren: string[] = [];

      // ── Serialize top-level section fields ──
      for (const field of section.fields || []) {
        if (!isBodyField(field.id, schema)) continue;

        const pairName = field.field_pair;

        // Special case: inscriptio pair in contextus section
        // Produces a combined <ab type="inscriptio"> with nested <persName> + text
        if (sectionId === "text" && pairName === "recipient") {
          if (processedPairs.has("recipient")) continue;
          processedPairs.add("recipient");

          const inscriptioText = getStr(data, "inscriptio_text");
          const inscriptioNorm = getStr(data, "inscriptio_analysis");
          if (inscriptioText || inscriptioNorm) {
            let inner = "";
            if (inscriptioNorm) {
              inner += `\n            <persName type="inscriptio_analysis">${esc(inscriptioNorm)}</persName>`;
            }
            if (inscriptioText) {
              inner += `\n            ${esc(inscriptioText)}`;
            }
            sectionChildren.push(
              `        <ab type="inscriptio">${inner}\n        </ab>`,
            );
          }
          continue;
        }

        if (pairName && processedPairs.has(pairName)) continue;

        // Skip text fields of pairs that have an analysis field
        const pairInfo = pairName ? bodyPairMap.get(pairName) : undefined;
        if (pairInfo?.text === field.id && pairInfo.analysis) continue;

        if (pairName) processedPairs.add(pairName);
        sectionChildren.push(...serializeBodyField(field, 8));
      }

      // ── Serialize subsections (eschatocol → subscriptions) ──
      if (sectionId === "eschatocol") {
        for (const sub of section.subsections || []) {
          if (sub.id !== "subscriptions") continue;

          const subChildren: string[] = [];

          for (const field of sub.fields || []) {
            if (!isBodyField(field.id, schema)) continue;

            const pairName = field.field_pair;
            if (pairName && processedPairs.has(pairName)) continue;

            // Skip text fields of pairs that have an analysis field
            const pairInfo = pairName
              ? bodyPairMap.get(pairName)
              : undefined;
            if (pairInfo?.text === field.id && pairInfo.analysis) continue;

            if (pairName) processedPairs.add(pairName);

            // Special case: subscriptio_emittentis_text uses multi-line
            // formatting with nested <persName>
            if (field.id === "subscriptio_emittentis_text") {
              const name = getStr(data, "subscriptio_emittentis_text");
              if (name) {
                subChildren.push(
                  `          <ab type="subscriptio" subtype="emittens">\n` +
                    `            <persName>${esc(name)}</persName>\n` +
                    `          </ab>`,
                );
              }
              continue;
            }

            // Special case: testes_names wrap entries in <listPerson>
            if (field.id === "testes_names") {
              const fragments = serializeBodyField(field, 10);
              if (fragments.length > 0) {
                subChildren.push(
                  `          <listPerson>\n` +
                    fragments.join("\n") +
                    `\n          </listPerson>`,
                );
              }
              continue;
            }

            subChildren.push(...serializeBodyField(field, 10));
          }

          // Also process nested subsections within subscriptions
          for (const innerSub of sub.subsections || []) {
            for (const field of innerSub.fields || []) {
              if (!isBodyField(field.id, schema)) continue;
              const pairName = field.field_pair;
              if (pairName && processedPairs.has(pairName)) continue;
              const pairInfo = pairName ? bodyPairMap.get(pairName) : undefined;
              if (pairInfo?.text === field.id && pairInfo.analysis) continue;
              if (pairName) processedPairs.add(pairName);
              subChildren.push(...serializeBodyField(field, 10));
            }
          }

          if (subChildren.length > 0) {
            const subDiv = makeDivContainer(
              "subscriptio",
              subChildren,
              undefined,
              "        ",
            );
            if (subDiv) sectionChildren.push(subDiv);
          }
        }
      }

      if (sectionChildren.length > 0) {
        const sectionDiv = makeDivContainer(
          divType,
          sectionChildren,
          undefined,
          "      ",
        );
        if (sectionDiv) bodyContent.push(sectionDiv);
      }
    }
  }
  // ── end schema-driven body section ──

  // ── Assemble document ──
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<?xml-model href="http://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_all.rng" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"?>',
    `<TEI xmlns="http://www.tei-c.org/ns/1.0"${docId ? ` xml:id="${esc(docId)}"` : ""}>`,
    "  <teiHeader>",
    "    <fileDesc>",
    "      <titleStmt>",
  ];
  lines.push(...titleStmt);
  lines.push(
    "      </titleStmt>",
    "      <publicationStmt>",
    "        <p>Encoded by Sema TEI Corpus Explorer</p>",
    "      </publicationStmt>",
    "      <sourceDesc>",
    "        <msDesc>",
    "          <msIdentifier>",
  );
  if (msId.length > 0) lines.push(...msId);
  lines.push("          </msIdentifier>");
  if (msItem.length > 0) {
    lines.push(
      "          <msContents>",
      "            <msItem>",
      ...msItem,
      "            </msItem>",
      "          </msContents>",
    );
  }
  lines.push(
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
  );
  if (creation.length > 0) lines.push(...creation);
  lines.push(
    "      </creation>",
    "      <langUsage>",
    '        <language ident="la">Latin</language>',
    "      </langUsage>",
    "      <textClass>",
    "        <keywords>",
  );
  lines.push(...kwTerms);
  lines.push(
    "        </keywords>",
    "      </textClass>",
    "    </profileDesc>",
    "  </teiHeader>",
    "  <text>",
    "    <body>",
  );
  if (bodyContent.length > 0) lines.push(...bodyContent);
  lines.push(
    "    </body>",
    "  </text>",
    "</TEI>",
  );

  return lines.join("\n");
}

/**
 * Derive the charter code from form submission data.
 * The API route handles progressive numbering.
 */
export function buildFilename(data: FormSubmissionData): string {
  return deriveCharterCode(data.charter_type || "unknown");
}
